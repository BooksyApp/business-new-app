import { API_BASE_URL } from '@/config/api';
import { useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { AppLayout, PageHeader } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Sparkles, Scissors, Heart, Stethoscope, MapPin } from "lucide-react";
import { toast } from "sonner";
import AddressMapPicker from "@/components/AddressMapPicker";
import { businessService } from "@/services/businessService";
import { getCurrentUser } from "@/utils/businessUtils";

// #9 (salon-hub QA follow-up): "Add a business" used to be a bare name field on the
// picker screen that created a business with nothing else filled in — not what an
// owner adding a second business expects. This is the same category + address/map
// picker as the registration wizard's Step 2/3, reused here as its own page (matching
// AddServicePage/AddStaffPage's "dedicated page for Add X" pattern) so a new business
// starts with real details instead of a name-only stub.

const featuredCategories = [
  { id: "nail-salons", name: "Nail salons", icon: Sparkles },
  { id: "brows-lashes", name: "Brows & Lashes", icon: Heart },
  { id: "skin-care", name: "Skin care", icon: Heart },
  { id: "hair-salons", name: "Hair salons", icon: Scissors },
  { id: "aesthetic-medicine", name: "Aesthetic medicine", icon: Stethoscope },
  { id: "barbers", name: "Barbers", icon: Scissors },
];

const otherCategories = [
  "Automotive", "Dental", "Diet & training", "Hair Removal", "Health",
  "Massage", "Tattoo & Piercing", "Wellness", "Yoga & Fitness",
];

export default function CreateBusinessPage() {
  const navigate = useNavigate();
  const searchAddressRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [phone, setPhone] = useState("");

  const [addressSearch, setAddressSearch] = useState("");
  const [address, setAddress] = useState("");
  const [buildingNumber, setBuildingNumber] = useState("");
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [addressResults, setAddressResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const [creating, setCreating] = useState(false);

  const searchAddress = async (query: string) => {
    if (query.length < 2) {
      setAddressResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const response = await fetch(
        // #56: proxied through the backend — see GeocodeService. The User-Agent set
        // here never left the browser (forbidden header), so OSM never received the
        // identification its policy requires.
        `${API_BASE_URL}/public/geocode?q=${encodeURIComponent(query)}`
      );
      const data = await response.json();
      setAddressResults(data);
    } catch (error) {
      console.error("Error searching address:", error);
      setAddressResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const canCreate = name.trim() !== "" && !creating;

  const handleCreate = async () => {
    if (!canCreate) {
      if (!name.trim()) toast.error("Enter your business name");
      return;
    }
    setCreating(true);
    try {
      const user = getCurrentUser();
      const business = await businessService.createBusiness({
        ownerId: user?.id,
        name: name.trim(),
        category: category || undefined,
        address: address || undefined,
        city: address?.split(",")[1]?.trim() || undefined,
        phone: phone || undefined,
        latitude: latitude ?? undefined,
        longitude: longitude ?? undefined,
      });
      localStorage.setItem("currentBusinessId", business.id.toString());
      localStorage.setItem("currentBusiness", JSON.stringify(business));
      toast.success("Business created!");
      navigate(`/${business.id}/calendar`, { replace: true });
    } catch {
      toast.error("Failed to create business. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <AppLayout>
      <PageHeader
        title="Add a business"
        subtitle="Set up a new business under your account"
        actions={
          <Link to="/?switch=1">
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
        }
      />
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        <Card>
          <CardContent className="pt-6 space-y-6">
            <div className="space-y-3">
              <Label className="text-sm font-medium">Business Category</Label>
              <div className="grid grid-cols-3 gap-3">
                {featuredCategories.map((cat) => {
                  const Icon = cat.icon;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setCategory(cat.id)}
                      className={`p-4 rounded-xl border-2 transition-all ${
                        category === cat.id
                          ? "border-foreground bg-accent/10"
                          : "border-border hover:border-foreground/40 bg-background"
                      }`}
                    >
                      <Icon className={`h-6 w-6 mx-auto mb-2 ${category === cat.id ? "text-foreground" : "text-muted-foreground"}`} />
                      <p className="text-xs font-medium leading-tight">{cat.name}</p>
                    </button>
                  );
                })}
              </div>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="h-12 mt-2">
                  <SelectValue placeholder="Or select another category" />
                </SelectTrigger>
                <SelectContent>
                  {otherCategories.map((cat) => (
                    <SelectItem key={cat} value={cat.toLowerCase().replace(/\s+/g, "-")}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bizName" className="text-sm font-medium">Business Name</Label>
              <Input
                id="bizName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Glamour Studio"
                className="h-12"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bizPhone" className="text-sm font-medium">
                Phone <span className="text-muted-foreground font-normal">(Optional)</span>
              </Label>
              <Input
                id="bizPhone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. 501234567"
                className="h-12"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6 space-y-6">
            <div className="space-y-2">
              <Label htmlFor="bizAddress" className="text-sm font-medium">
                Business Address <span className="text-muted-foreground font-normal">(Optional)</span>
              </Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  id="bizAddress"
                  value={addressSearch}
                  onChange={(e) => {
                    const value = e.target.value;
                    setAddressSearch(value);
                    if (searchAddressRef.current) clearTimeout(searchAddressRef.current);
                    if (value.length >= 2) {
                      searchAddressRef.current = setTimeout(() => searchAddress(value), 300);
                    } else {
                      setAddressResults([]);
                      setIsSearching(false);
                    }
                  }}
                  placeholder="Search for an address"
                  className="pl-11 h-12"
                />
              </div>
              {isSearching && <div className="text-sm text-muted-foreground mt-2">Searching...</div>}
              {addressResults.length > 0 && !isSearching && (
                <div className="border rounded-lg mt-2 max-h-48 overflow-y-auto bg-background shadow-sm">
                  {addressResults.map((addr, index) => {
                    const displayName = addr.display_name || addr.name || "";
                    const addressParts = displayName.split(",").slice(0, 3).join(",");
                    return (
                      <button
                        key={index}
                        type="button"
                        onClick={() => {
                          const lat = parseFloat(addr.lat);
                          const lon = parseFloat(addr.lon);
                          setAddress(displayName);
                          setLatitude(lat);
                          setLongitude(lon);
                          const bn = addr.address?.house_number || addr.address?.building || "";
                          if (bn) setBuildingNumber(bn);
                          setAddressSearch(addressParts);
                          setAddressResults([]);
                        }}
                        className="w-full text-left px-4 py-3 hover:bg-accent/10 border-b last:border-0 transition-colors"
                      >
                        <p className="font-medium text-sm">{displayName}</p>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {address && (
              <div className="space-y-2">
                <Label htmlFor="buildingNumber" className="text-sm font-medium">Building Number</Label>
                <Input
                  id="buildingNumber"
                  value={buildingNumber}
                  onChange={(e) => setBuildingNumber(e.target.value)}
                  placeholder="e.g., 12"
                  className="h-12"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-sm font-medium">Pin Your Exact Location on Map</Label>
              <AddressMapPicker
                onLocationSelect={(lat, lng, resolvedAddress, bn) => {
                  setLatitude(lat);
                  setLongitude(lng);
                  if (resolvedAddress) {
                    setAddress(resolvedAddress);
                    setAddressSearch(resolvedAddress.split(",").slice(0, 3).join(","));
                  }
                  if (bn) setBuildingNumber(bn);
                }}
                selectedPosition={latitude && longitude ? [latitude, longitude] : null}
              />
              {latitude && longitude && (
                <div className="text-xs text-muted-foreground">
                  Coordinates: {latitude.toFixed(6)}, {longitude.toFixed(6)}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Link to="/?switch=1">
            <Button variant="outline" disabled={creating}>Cancel</Button>
          </Link>
          <Button onClick={handleCreate} disabled={!canCreate}>
            {creating ? "Creating…" : "Create Business"}
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}
