import { AppLayout, PageHeader } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useEffect, useMemo, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useNavigation } from "@/utils/navigationUtils";
import {
  Building2,
  Clock,
  CreditCard,
  Bell,
  Shield,
  Palette,
  Globe,
  Users,
  ChevronRight,
  Star
} from "lucide-react";

interface SettingsCategory {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  items: Array<{ label: string; path?: string }>;
  color: string;
  bgColor: string;
  borderColor: string;
  mainPath?: string;
}

const settingsCategories: SettingsCategory[] = [
  {
    id: "business",
    title: "Business Settings",
    description: "Manage your salon details and locations",
    icon: Building2,
    mainPath: "business",
    items: [
      { label: "Business Profile", path: "business" },
      { label: "Opening Hours", path: "business-hours" },
      { label: "Locations", path: "locations" },
    ],
    color: "text-appointment-blue",
    bgColor: "bg-appointment-blue/10",
    borderColor: "border-appointment-blue/20",
  },
  {
    id: "booking",
    title: "Booking Settings",
    description: "Configure your booking preferences",
    icon: Clock,
    mainPath: "booking-rules",
    items: [
      // These were three labels for the same handful of fields on the business record:
      // one redirected to the staff page and two did nothing. They are one screen now.
      { label: "Deposits & cancellations", path: "booking-rules" },
      { label: "Opening hours", path: "business-hours" },
      { label: "Services & pricing", path: "items-category" },
    ],
    color: "text-appointment-purple",
    bgColor: "bg-appointment-purple/10",
    borderColor: "border-appointment-purple/20",
  },
  {
    id: "payments",
    title: "Payments",
    description: "Manage payment methods and billing",
    icon: CreditCard,
    // #27: this page's own convention is "no badge = built, Soon = not". Payments broke
    // it: it had no badge, implying real screens, while all three items just navigated to
    // the Sales page. There is no Payment Methods, Invoices or Tax Settings screen, so the
    // honest label is Soon — and the redirects are removed, because sending someone who
    // asked for Tax Settings to a sales list is worse than doing nothing.
    mainPath: "booking-rules",
    items: [
      { label: "Currency & tax", path: "booking-rules" },
      { label: "Sales & receipts", path: "sales" },
    ],
    color: "text-status-completed",
    bgColor: "bg-status-completed/10",
    borderColor: "border-status-completed/20",
  },
  {
    id: "security",
    title: "Security",
    description: "Manage access and permissions",
    icon: Shield,
    mainPath: "security",
    items: [
      { label: "Change password", path: "security" },
    ],
    color: "text-status-pending",
    bgColor: "bg-status-pending/10",
    borderColor: "border-status-pending/20",
  },
  {
    id: "online",
    title: "Online Presence",
    description: "Manage your online booking page",
    icon: Globe,
    mainPath: "business",
    items: [
      { label: "Salon profile & photo", path: "business" },
      { label: "Reviews", path: "reviews" },
      { label: "Referral programme", path: "referral-program" },
    ],
    color: "text-appointment-teal",
    bgColor: "bg-appointment-teal/10",
    borderColor: "border-appointment-teal/20",
  },
  {
    id: "team",
    title: "Team Permissions",
    description: "Control staff access levels",
    icon: Users,
    mainPath: "staff",
    items: [
      { label: "Staff & roles", path: "staff" },
      { label: "Working hours", path: "business-hours" },
    ],
    color: "text-appointment-green",
    bgColor: "bg-appointment-green/10",
    borderColor: "border-appointment-green/20",
  },
];

export default function SetupPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { getPath } = useNavigation();
  const businessCardRef = useRef<HTMLDivElement | null>(null);
  const focusedCategory = useMemo(() => {
    const query = new URLSearchParams(location.search);
    return query.get("focus");
  }, [location.search]);

  useEffect(() => {
    if (focusedCategory !== "business") return;
    businessCardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [focusedCategory]);

  const handleCardClick = (category: SettingsCategory) => {
    if (category.mainPath) {
      navigate(getPath(category.mainPath));
    }
  };

  const handleItemClick = (e: React.MouseEvent, path?: string) => {
    if (!path) return;
    e.stopPropagation();
    navigate(getPath(path));
  };

  return (
    <AppLayout>
      <PageHeader
        title="Setup"
        subtitle="Configure your salon settings and preferences"
      />

      <div className="p-6">
        <div className="grid gap-5 md:grid-cols-2">
          {settingsCategories.map((category, index) => {
            const Icon = category.icon;
            const isFocused = focusedCategory === category.id;
            const isClickable = !!category.mainPath;

            return (
              <Card
                key={category.title}
                ref={category.id === "business" ? businessCardRef : null}
                onClick={() => handleCardClick(category)}
                className={`border-border/60 shadow-sm hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-card to-card/95 backdrop-blur-sm group card-interactive ${category.borderColor} hover:border-2 ${isFocused ? "ring-2 ring-appointment-blue/40 border-appointment-blue/50 shadow-lg" : ""} ${isClickable ? "cursor-pointer hover:scale-[1.01]" : "cursor-default"}`}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <CardHeader className="pb-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      <div className={`p-3 rounded-xl ${category.bgColor} group-hover:scale-110 transition-transform duration-300 shadow-sm`}>
                        <Icon className={`h-6 w-6 ${category.color}`} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-base font-bold">{category.title}</CardTitle>
                        </div>
                        <CardDescription className="text-sm font-medium mt-0.5">{category.description}</CardDescription>
                      </div>
                    </div>
                    <ChevronRight className={`h-5 w-5 text-muted-foreground transition-all ${isClickable ? "group-hover:text-accent group-hover:translate-x-1" : ""} ${category.color}`} />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {category.items.map((item) => (
                      <Button
                        key={item.label}
                        variant="secondary"
                        size="sm"
                        className="text-xs border-border/60 transition-all hover:border-accent/40 hover:bg-accent/5 cursor-pointer"
                        onClick={(e) => handleItemClick(e, item.path)}
                      >
                        {item.label}
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
}
