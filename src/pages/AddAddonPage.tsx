import AddonsPage from "./AddonsPage";

/**
 * /add-addon used to be a full page of its own. It now opens the add-on sheet on the
 * Add-ons page (same fields, plus "save & add next"), so deep links keep working.
 */
export default function AddAddonPage() {
  return <AddonsPage startNew />;
}
