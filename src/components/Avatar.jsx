import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

// Account avatar (usually the Google profile photo). Renders the photo when the
// URL is usable and falls back to the person's initial when there is none, when
// the image fails to load, or when Google blocks the request.
//
// `referrerPolicy="no-referrer"` matters for googleusercontent.com photos: the
// image host rejects some cross-origin referrers, which otherwise shows a
// broken image instead of the avatar.
export default function Avatar({
  src,
  name,
  email,
  alt = "",
  className,
  fallbackClassName,
  style,
  ...props
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  const initial = String(name || email || "?").trim().charAt(0).toUpperCase() || "?";

  if (src && !failed) {
    return (
      <img
        src={src}
        alt={alt}
        style={style}
        decoding="async"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className={cn("rounded-full object-cover", className)}
        {...props}
      />
    );
  }

  return (
    <span
      aria-hidden={alt ? undefined : true}
      aria-label={alt || undefined}
      style={style}
      className={cn(
        "flex items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground",
        className,
        fallbackClassName,
      )}
      {...props}
    >
      {initial}
    </span>
  );
}
