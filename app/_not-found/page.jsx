// Explicit page for Next's internal /_not-found route. The root optional
// catch-all matches this path too, so without a direct page entry Next's build
// cannot resolve the custom app/not-found.jsx boundary.
export { default } from '../not-found';
