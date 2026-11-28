import { useCallback, useEffect, useRef, useState } from "react";

import CheckInProgressDialog from "@/components/CheckInProgressDialog";
import CheckInResult from "@/components/CheckInResult";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { checkInByQrValue, parseQrValue } from "@/lib/checkin";
import { decodeGrayscale, toGrayscale } from "@/lib/qr-decode";
import { cn } from "@/lib/utils";
import { CameraOff, Flashlight, FlashlightOff, History, Loader2, QrCode, ScanLine } from "lucide-react";

const SCAN_INTERVAL_MS = 250;
const CAPTURE_MAX_WIDTH = 800;
const SCAN_DEDUPE_MS = 2000;
const MAX_SCAN_QUEUE = 5;
const SUCCESS_NEXT_DELAY_MS = 800;
const SUCCESS_CLOSE_DELAY_MS = 1200;

export default function AdminCheckIn({ eventId = undefined, onCheckedIn = undefined, compact = false }) {
  const scannerRef = useRef(null);
  const videoRef = useRef(null);
  const queueRef = useRef([]);
  const activeRef = useRef(null);
  const drainingRef = useRef(false);
  const drainQueueRef = useRef(null);
  const closeTimerRef = useRef(null);

  const [scanning, setScanning] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [manual, setManual] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [history, setHistory] = useState([]);
  const [activeScan, setActiveScan] = useState(null);

  const drainQueue = useCallback(async () => {
    if (drainingRef.current || activeRef.current || closeTimerRef.current) return;
    const token = queueRef.current.shift();
    if (!token) return;

    drainingRef.current = true;
    activeRef.current = token;
    setBusy(true);
    setError("");
    setResult(null);
    setActiveScan({ token, phase: "processing", queued: queueRef.current.length });

    let succeeded = false;

    try {
      const data = await checkInByQrValue(token, eventId);
      setResult({ ...data, token });
      try { onCheckedIn?.(data); } catch { /* a failed refresh must not undo a successful check-in */ }
      setHistory((prev) =>
        [{ registration: data.registration, already: data.already, at: new Date() }, ...prev].slice(0, 8)
      );
      setActiveScan({ token, phase: "success", result: data, queued: queueRef.current.length });
      succeeded = true;
    } catch (e) {
      const message = e?.message || "Check-in failed.";
      setResult(null);
      setError(message);
      setActiveScan({ token, phase: "error", error: message, queued: queueRef.current.length });
    } finally {
      setBusy(false);
      activeRef.current = null;
      drainingRef.current = false;
    }

    // Errors stay until staff dismisses them so a failure isn't missed. Success
    // auto-advances, keeping the camera live and the queue moving.
    if (succeeded) {
      closeTimerRef.current = setTimeout(() => {
        closeTimerRef.current = null;
        if (queueRef.current.length) drainQueueRef.current?.();
        else setActiveScan(null);
      }, queueRef.current.length ? SUCCESS_NEXT_DELAY_MS : SUCCESS_CLOSE_DELAY_MS);
    }
  }, [eventId, onCheckedIn]);

  useEffect(() => {
    drainQueueRef.current = drainQueue;
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
      queueRef.current = [];
    };
  }, [drainQueue]);

  const enqueueCheckIn = useCallback((value) => {
    const token = parseQrValue(value);
    if (!token) {
      const message = "That doesn't look like a valid ticket code.";
      setError(message);
      setActiveScan({ token: "", phase: "error", error: message, queued: queueRef.current.length });
      return;
    }

    if (activeRef.current === token || queueRef.current.includes(token)) return;

    const ctx = scannerRef.current;
    if (ctx?.seen) {
      const now = Date.now();
      for (const [seenToken, at] of ctx.seen) {
        if (now - at > SCAN_DEDUPE_MS) ctx.seen.delete(seenToken);
      }
      // The same QR stays in front of the camera for several frames — ignore
      // repeat hits instead of firing duplicate check-in requests.
      if (now - (ctx.seen.get(token) || 0) < SCAN_DEDUPE_MS) return;
      ctx.seen.set(token, now);
    }

    if (queueRef.current.length >= MAX_SCAN_QUEUE) {
      setActiveScan((prev) => ({
        token: prev?.token ?? token,
        phase: prev?.phase ?? "error",
        result: prev?.result,
        error: prev?.error ?? "Scan queue is full.",
        queued: queueRef.current.length,
        notice: "Scan queue is full — wait for the current checks to finish.",
      }));
      return;
    }

    queueRef.current.push(token);
    setActiveScan((prev) =>
      prev ? { ...prev, queued: queueRef.current.length, notice: undefined } : prev
    );
    drainQueueRef.current?.();
  }, []);

  const continueFromModal = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    if (queueRef.current.length) drainQueueRef.current?.();
    else setActiveScan(null);
  }, []);

  const stopCamera = useCallback(() => {
    const ctx = scannerRef.current;
    scannerRef.current = null;
    setScanning(false);
    setTorchOn(false);
    if (ctx?.timer) clearTimeout(ctx.timer);
    if (ctx?.stream) ctx.stream.getTracks().forEach((t) => t.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
    ctx?.seen?.clear();
    queueRef.current = [];
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setActiveScan((prev) => (prev ? { ...prev, queued: 0 } : prev));
  }, []);

  const toggleTorch = async () => {
    const track = scannerRef.current?.track;
    if (!track) return;
    const next = !torchOn;
    try {
      await track.applyConstraints({ advanced: [{ torch: next }] });
      setTorchOn(next);
    } catch {
      setTorchOn(false);
    }
  };

  // Camera + QR decoding runs fully offline in this app: getUserMedia for
  // the video feed plus the built-in decoder (qr-decode.js) — no libraries,
  // no network. The <video> element must be in the DOM first, so the stream
  // is opened from an effect that runs AFTER the `scanning` state flips true
  // and the element is rendered. A scan only queues work; it never stops the
  // camera, so the stream and the decode loop stay live between tickets.
  useEffect(() => {
    if (!scanning) return;
    let cancelled = false;

    (async () => {
      setCameraError("");
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        setScanning(false);
        setCameraError(
          "This browser can't open the camera. Use manual entry below instead."
        );
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        const video = videoRef.current;
        video.srcObject = stream;
        await video.play();
        const canvas = document.createElement("canvas");
        const track = stream.getVideoTracks()[0] || null;
        let supportsTorch = false;
        try {
          const caps = track?.getCapabilities?.();
          supportsTorch = !!caps && "torch" in caps;
        } catch {
          supportsTorch = false;
        }
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        setTorchSupported(supportsTorch);
        setTorchOn(false);
        const ctx = { stream, track, timer: null, decoding: false, seen: new Map() };
        scannerRef.current = ctx;
        const tick = () => {
          if (cancelled || !scannerRef.current || ctx.decoding) return;
          ctx.decoding = true;
          try {
            const vw = video.videoWidth || 640;
            const vh = video.videoHeight || 480;
            const scale = Math.min(1, CAPTURE_MAX_WIDTH / vw);
            canvas.width = Math.round(vw * scale);
            canvas.height = Math.round(vh * scale);
            const g = canvas.getContext("2d", { willReadFrequently: true });
            g.drawImage(video, 0, 0, canvas.width, canvas.height);
            const frame = g.getImageData(0, 0, canvas.width, canvas.height);
            const hit = decodeGrayscale(
              toGrayscale(frame.data, canvas.width, canvas.height),
              canvas.width,
              canvas.height
            );
            if (hit?.text) {
              try {
                navigator.vibrate?.(60);
              } catch {
                /* haptics unsupported */
              }
              enqueueCheckIn(hit.text);
            }
          } catch {
            /* frame not ready yet */
          }
          ctx.decoding = false;
          if (!cancelled && scannerRef.current) ctx.timer = setTimeout(tick, SCAN_INTERVAL_MS);
        };
        tick();
      } catch (e) {
        if (cancelled) return;
        setScanning(false);
        const name = e?.name || "";
        const raw = e?.message || "";
        let msg = "Could not start the camera. Check your browser's camera settings or use manual entry below.";
        if (/denied|permission|notallowed/i.test(raw) || /notallowed/i.test(name)) {
          msg = "Camera permission denied. Allow camera access for this site, then try again — or use manual entry below.";
        } else if (/notfound|no camera|noacamera/i.test(raw) || /notfound/i.test(name)) {
          msg = "No camera was found on this device. Use manual entry below instead.";
        } else if (/insecure|secure context|https/i.test(raw)) {
          msg = "The camera needs a secure (HTTPS) connection or localhost. Use manual entry below instead.";
        } else if (raw) {
          msg = raw;
        }
        setCameraError(msg);
      }
    })();

    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [scanning, enqueueCheckIn, stopCamera]);

  const handleManual = (e) => {
    e.preventDefault();
    const value = manual.trim();
    if (!value) return;
    enqueueCheckIn(value);
    setManual("");
  };

  const cameraSupported =
    typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">QR Check-in</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Scan an attendee's ticket QR to check them in at the door.
          </p>
        </div>
        {torchSupported && scanning && (
          <Button
            variant={torchOn ? "default" : "outline"}
            onClick={toggleTorch}
            aria-pressed={torchOn}
            title="Toggle flashlight"
          >
            {torchOn ? <Flashlight className="mr-1.5 h-4 w-4" /> : <FlashlightOff className="mr-1.5 h-4 w-4" />}
            Torch
          </Button>
        )}
      </div>

      <div className={cn("grid gap-6", !compact && "md:grid-cols-2")}>
        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Scanner</h2>
            <div className="mt-3">
              {scanning ? (
                <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-black">
                  <video ref={videoRef} muted playsInline className="h-full w-full object-cover" />
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <div className="h-44 w-44 rounded-2xl border-2 border-white/80 bg-white/10" />
                  </div>
                  <button
                    type="button"
                    onClick={stopCamera}
                    className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs text-white hover:bg-black/80"
                  >
                    <CameraOff className="mr-1 inline h-3.5 w-3.5" /> Stop camera
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setScanning(true)}
                  className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-muted/40 text-center hover:bg-muted/70"
                >
                  <QrCode className="h-12 w-12 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">Camera off — click to start scanning a ticket QR.</p>
                </button>
              )}
            </div>
            {cameraError && <p className="mt-3 text-sm text-rose-500">{cameraError}</p>}
            {!scanning && !cameraError && (
              <p className="mt-3 text-xs text-muted-foreground">
                {cameraSupported
                  ? "Tip: keep the QR inside the box. No camera? Use manual entry below."
                  : "This browser can't open the camera for QR scanning — use manual entry below."}
              </p>
            )}
          </div>

          <form onSubmit={handleManual} className="rounded-2xl border border-border bg-card p-4">
            <Label htmlFor="manual-code">Manual entry</Label>
            <div className="mt-1.5 flex gap-2">
              <Input
                id="manual-code"
                value={manual}
                onChange={(e) => setManual(e.target.value)}
                placeholder="Ticket link, QR token, or REG number"
              />
              <Button type="submit" disabled={busy || !manual.trim()}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanLine className="mr-1.5 h-4 w-4" />}
                Check in
              </Button>
            </div>
          </form>
        </div>

        <div className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Result</h2>
          <CheckInResult result={result} error={error} busy={busy} />

          {history.length > 0 && (
            <div className="rounded-2xl border border-border bg-card p-4">
              <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                <History className="h-4 w-4" /> Recent scans
              </h3>
              <ul className="mt-3 space-y-2">
                {history.map((h, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm">
                    <span className={cn("h-2 w-2 shrink-0 rounded-full", h.already ? "bg-amber-400" : "bg-emerald-500")} />
                    <span className="flex-1 truncate">
                      {h.registration?.guest_name || h.registration?.guest_email || h.registration?.registration_number || "Unknown"}
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">{h.registration?.registration_number}</span>
                    <span className="text-xs text-muted-foreground">{h.already ? "already in" : "checked in"}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      <CheckInProgressDialog scan={activeScan} onContinue={continueFromModal} />
    </div>
  );
}
