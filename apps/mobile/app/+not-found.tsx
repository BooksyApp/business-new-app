import { Redirect } from 'expo-router';

/** Unknown deep link / stale route: go home (index decides login vs calendar) instead of the framework's raw "unmatched route" page. */
export default function NotFound() {
  return <Redirect href="/" />;
}
