import { NavLink, useLocation, useNavigate } from "react-router-dom";

import {
  ChevronDown,
  LogOut,
  Building2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useState } from "react";
import { LanguageModal } from "./LanguageModal";
import { useBusinessId } from "@/hooks/useBusinessId";
import { authService } from "@/services/authService";
import { clearAuthData } from "@/utils/authUtils";
import { getCurrentUser } from "@/utils/businessUtils";

import { useVisibleNavGroups } from "./navigation";

const GlobeIcon = ({ className, size = 24 }: { className?: string; size?: number }) => {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <g fillRule="evenodd">
        <circle cx="12" cy="12" r="12" fill="currentColor" />
        <path d="M15.094 13.978c-1.146 0-1.946-.813-1.946-1.978s.8-1.978 1.946-1.978c1.145 0 1.945.813 1.945 1.978s-.8 1.978-1.945 1.978M9.07 10.022h3.883l-.094.09c-.537.515-.844 1.203-.844 1.888 0 1.738 1.294 3 3.079 3 1.786 0 3.082-1.262 3.082-3s-1.296-3-3.082-3H9.079C7.295 9 6 10.262 6 12s1.295 3 3.079 3h2.144v-1.022H9.07c-1.136 0-1.932-.813-1.937-1.978 0-1.146.815-1.978 1.937-1.978" fill="white" />
      </g>
    </svg>
  );
};

const languages = [
  { code: "en-US", name: "English (United States)", flag: "🇺🇸" },
  { code: "en-GB", name: "English (Great Britain)", flag: "🇬🇧" },
  { code: "pl", name: "Polish", flag: "🇵🇱" },
  { code: "es-ES", name: "Spanish (Spain)", flag: "🇪🇸" },
  { code: "es", name: "Spanish", flag: "🇪🇸" },
  { code: "pt-BR", name: "Portuguese (Brazil)", flag: "🇧🇷" },
  { code: "fr", name: "French", flag: "🇫🇷" },
  { code: "vi", name: "Vietnamese", flag: "🇻🇳" },
  { code: "uk", name: "Ukrainian", flag: "🇺🇦" },
  { code: "zh-CN", name: "Simplified Chinese", flag: "🇨🇳" },
];

export function Sidebar() {
  const location = useLocation();
  // The rail read navGroups directly, so switched-off features and a team member's role
  // limits were applied on the section pages but not here.
  const visibleGroups = useVisibleNavGroups();
  const navigate = useNavigate();
  const businessId = useBusinessId();
  const [selectedLanguage, setSelectedLanguage] = useState("pl");
  const [isLanguageModalOpen, setIsLanguageModalOpen] = useState(false);

  // #9 (salon-hub QA): there was no owner-identity element in the sidebar at all — the
  // circle in its place was a dead "theme selector" (no onClick, never wired to
  // anything) whose label read "THEM" instead of showing who's logged in.
  const currentUser = getCurrentUser();
  const initials = currentUser?.fullName
    ? currentUser.fullName
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part: string) => part[0]!.toUpperCase())
        .join("")
    : (currentUser?.email?.[0]?.toUpperCase() ?? "?");

  const handleLogout = async () => {
    await authService.logout();
    clearAuthData();
    navigate('/login', { replace: true });
  };
  
  // Helper function to get the full path with businessId
  const getPath = (path: string): string => {
    // If we're in a business-specific route, prepend businessId
    if (businessId > 0 && path !== "/") {
      return `/${businessId}${path}`;
    }
    return path;
  };

  // Get current language flag component
  const getLanguageFlagComponent = (code: string) => {
    if (code === "pl") {
      return (
        <div className="w-full h-full">
          <div className="h-1/2 bg-white"></div>
          <div className="h-1/2 bg-red-600"></div>
        </div>
      );
    }
    // For other languages, show emoji flag
    const lang = languages.find(l => l.code === code);
    return (
      <div className="w-full h-full flex items-center justify-center text-base leading-none">
        {lang?.flag || "🇵🇱"}
      </div>
    );
  };

  return (
    <>
      <aside className="fixed left-0 top-0 z-50 h-screen w-[72px] bg-[#1a1a1a] border-r border-[#2a2a2a]/50 flex flex-col relative">
        {/* Top Section - Language Selector */}
        <div className="flex flex-col items-center pt-4 pb-2 border-b border-[#2a2a2a]/50">
          <div className="relative group">
            <div 
              onClick={() => setIsLanguageModalOpen(true)}
              className="flex flex-col items-center gap-1.5 cursor-pointer px-2 py-2 rounded hover:bg-white/5 transition-colors"
            >
              {/* Current Language Flag - Circular */}
              <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-white/20 shadow-sm">
                {getLanguageFlagComponent(selectedLanguage)}
              </div>
              <ChevronDown className="h-3 w-3 text-white/50" />
            </div>
          </div>
      </div>

        {/* Divider between flag and navigation */}
        <div className="w-full h-px bg-[#2a2a2a]/50"></div>

      {/* Main Navigation — grouped, with a flyout naming each group's pages */}
      {/* No overflow on either axis: a scroll container clips absolutely-positioned children,
          which is why the flyout was rendering and never visible. Six groups fit without
          scrolling, so there is nothing to scroll. */}
      <nav className="flex-1 flex flex-col items-center py-2 gap-0.5 overflow-visible relative">
        {visibleGroups.map((group) => {
          const paths = group.items
            ? [...group.items.map((i) => getPath(i.path)), getPath(`/section/${group.slug}`)]
            : [getPath(group.path!)];
          const isActive = paths.some(
            (full) =>
              location.pathname === full ||
              location.pathname.startsWith(full + "/") ||
              (full === getPath("/business") && location.pathname === `/${businessId}`)
          );
          const Icon = group.icon;

          return (
            <div
              key={group.label}
              className="relative w-full flex justify-center"
            >
              {/* One click, one page. A hover flyout meant the destinations only existed
                  while the pointer was on them; the section page keeps them somewhere. */}
              <NavLink
                to={group.path ? getPath(group.path) : getPath(`/section/${group.slug}`)}
                aria-label={group.label}
                className={cn(
                  "group relative flex items-center justify-center w-12 h-12 rounded-lg transition-all duration-200",
                  !isActive && "hover:bg-white/5"
                )}
              >
                {isActive && <div className="absolute left-[-12px] top-0 bottom-0 w-1 bg-[#f4f4f4]" />}
                <Icon
                  size={23}
                  className={cn(
                    "transition-colors",
                    isActive ? "text-[#f4f4f4]" : "text-[#7f8084] group-hover:text-white/80"
                  )}
                />
              </NavLink>
            </div>
          );
        })}
      </nav>

      {/* Bottom Section - Owner profile + Switch Business + Logout */}
      <div className="flex flex-col items-center gap-2.5 pt-2 pb-4 border-t border-[#2a2a2a]/50">
        {/* Link/Chain Icon */}
        <div className="w-10 h-10 rounded-full border border-white/20 bg-white/5 flex items-center justify-center cursor-pointer hover:bg-white/10 transition-colors group">
          <GlobeIcon size={16} className="text-white/40 group-hover:text-white/60" />
        </div>

        {/* Switch Business — the only way back to "/" (Select Business) from inside a
            business; ?switch=1 tells HomePage to show the picker even for a single
            business, instead of its usual auto-redirect straight into it. */}
        <Tooltip delayDuration={200}>
          <TooltipTrigger asChild>
            <button
              onClick={() => navigate('/?switch=1')}
              className="w-10 h-10 rounded-full border border-white/20 bg-white/5 flex items-center justify-center cursor-pointer hover:bg-white/10 transition-colors group"
              aria-label="Switch business"
            >
              <Building2 size={16} className="text-white/40 group-hover:text-white/60" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" className="bg-[#1a1a1a] text-white border-none px-3 py-1.5 text-sm">
            Switch business
          </TooltipContent>
        </Tooltip>

        {/* Owner profile */}
        <Tooltip delayDuration={200}>
          <TooltipTrigger asChild>
            <div className="w-10 h-10 rounded-full border border-white/20 bg-white/5 flex items-center justify-center cursor-default">
              <span className="text-xs font-semibold text-white/70 uppercase tracking-wider">{initials}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="right" className="bg-[#1a1a1a] text-white border-none px-3 py-1.5 text-sm">
            {currentUser?.fullName || currentUser?.email || "Signed in"}
          </TooltipContent>
        </Tooltip>

        {/* Logout */}
        <Tooltip delayDuration={200}>
          <TooltipTrigger asChild>
            <button
              onClick={handleLogout}
              className="w-10 h-10 rounded-full border border-white/20 bg-white/5 flex items-center justify-center cursor-pointer hover:bg-red-500/20 hover:border-red-500/40 transition-colors group"
              aria-label="Logout"
            >
              <LogOut size={16} className="text-white/40 group-hover:text-red-400" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" className="bg-[#1a1a1a] text-white border-none px-3 py-1.5 text-sm">
            Logout
          </TooltipContent>
        </Tooltip>
      </div>
    </aside>

      {/* Language Selection Modal */}
      <LanguageModal
        open={isLanguageModalOpen}
        onOpenChange={setIsLanguageModalOpen}
        selectedLanguage={selectedLanguage}
        onLanguageChange={setSelectedLanguage}
      />
    </>
  );
}
