import { NotFoundPage } from "@/components/ErrorPage";

// Catch-all route: the shared 404 view includes the site nav and links back
// into the app, instead of the old Base44 "ask the AI to build this" note.
export default function PageNotFound() {
  return <NotFoundPage />;
}
