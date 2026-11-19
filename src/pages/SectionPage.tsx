import { Navigate, useParams } from "react-router-dom";
import { SECTION_REDIRECTS } from "@/components/layout/navigation";
import { useNavigation } from "@/utils/navigationUtils";

/**
 * Old /section/<slug> addresses (the v1 rail's group pages). Every group's pages are now
 * either visible in the rail or tabs on one page, so the address goes straight there.
 */
export default function SectionPage() {
  const { section } = useParams<{ section: string }>();
  const { getPath } = useNavigation();
  return <Navigate to={getPath(SECTION_REDIRECTS[section ?? ""] ?? "/calendar")} replace />;
}
