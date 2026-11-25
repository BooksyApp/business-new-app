import { useBusinessId } from "@/hooks/useBusinessId";
import { keyForId } from "@/lib/salonKey";

/**
 * Hook to get navigation helper that includes businessId in paths
 */
export function useNavigation() {
  const businessId = useBusinessId();
  
  /**
   * Get a path with businessId prepended if we're in a business route
   * @param path - The path segment (e.g., "add-service", "edit-service")
   * @param id - Optional ID to append to the path (e.g., for edit routes)
   */
  const getPath = (path: string, id?: string | number): string => {
    // Remove leading slash if present
    const cleanPath = path.startsWith("/") ? path.slice(1) : path;
    
    // Construct full path with ID if provided
    let fullPath = cleanPath;
    if (id !== undefined) {
      fullPath = `${cleanPath}/${id}`;
    }
    
    // Inside a salon: /<slug>_<publicId>/<path> (lib/salonKey), never the numeric id.
    const key = keyForId(businessId);
    if (key && !fullPath.startsWith(`${key}/`)) {
      return `/${key}/${fullPath}`;
    }
    
    return `/${fullPath}`;
  };
  
  return { getPath, businessId };
}

