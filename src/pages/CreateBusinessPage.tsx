import { API_BASE_URL } from '@/config/api';
import { useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { AuthShell } from "@/components/auth/AuthShell";
import { SalonPreview } from "@/components/auth/SalonPreview";
import { authGhost, authInput, authLabel, authSubtitle, authTitle, brandCta, choiceCard } from "@/components/auth/authStyles";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Sparkles, Scissors, Heart, Stethoscope, MapPin } from "lucide-react";
import { toast } from "sonner";
import AddressMapPicker from "@/components/AddressMapPicker";
import { businessService } from "@/services/businessService";
import { getCurrentUser } from "@/utils/businessUtils";
import { t, tOpt } from "@/i18n";

// #9 (salon-hub QA follow-up): "Add a business" used to be a bare name field on the
// picker screen that created a business with nothing else filled in — not what an
// owner adding a second business expects. This is the same category + address/map
// picker as the registration wizard's Step 2/3, reused here as its own page (matching
// AddServicePage/AddStaffPage's "dedicated page for Add X" pattern) so a new business
// starts with real details instead of a name-only stub.

const featuredCategories = [
  { id: "nail-salons", get name() { return t("createBusiness.catNailSalons"); }, icon: Sparkles },
  { id: "brows-lashes", get name() { return t("createBusiness.catBrowsLashes"); }, icon: Heart },
  { id: "skin-care", get name() { return t("createBusiness.catSkinCare"); }, icon: Heart },
  { id: "hair-salons", get name() { return t("createBusiness.catHairSalons"); }, icon: Scissors },
  { id: "aesthetic-medicine", get name() { return t("createBusiness.catAestheticMedicine"); }, icon: Stethoscope },
  { id: "barbers", get name() { return t("createBusiness.catBarbers"); }, icon: Scissors },
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
  const [addressResults, setAddressResults] = useState<{ display_name?: string; name?: string; lat: string; lon: string; address?: { country?: string; country_code?: string; house_number?: string; building?: string } }[]>([]);
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
      if (!name.trim()) toast.error(t("createBusiness.enterYourBusinessName"));
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
      toast.success(t("createBusiness.businessCreated"));
      navigate(`/${business.id}/calendar`, { replace: true });
    } catch {
      toast.error(t("createBusiness.failedToCreateBusinessPlease"));
    } finally {
      setCreating(false);
    }
  };

  const categoryName = [...featuredCategories.map((c) => ({ id: c.id, name: c.name })), ...otherCategories.map((c) => ({ id: c.toLowerCase().replace(/\s+/g, "-"), name: tOpt("category", c) }))].find((c) => c.id === category)?.name ?? "";
  const user = getCurrentUser();
  const preview = (
    <SalonPreview
      data={{
        businessName: name.trim(),
        category: categoryName,
        address: [address.split(",").slice(0, 2).join(","), buildingNumber].filter(Boolean).join(" "),
        ownerName: [user?.firstName, user?.lastName].filter(Boolean).join(" "),
        businessHours: {},
        services: [],
        staff: [],
      }}
    />
  );

  return (
    <AuthShell headerLink={{ label: t("common.back"), to: "/?switch=1" }} aside={preview} footer={false} cardClassName="md:max-w-[560px]">
      <h1 className={authTitle}>{t("createBusiness.addABusiness")}</h1>
      <p className={authSubtitle}>{t("createBusiness.aNewSalonUnderYour")}</p>

      <form
        className="space-y-6"
        onSubmit={(e) => {
          e.preventDefault();
          void handleCreate();
        }}
      >
        <div>
          <label htmlFor="bizName" className={authLabel}>{t("common.businessName")}</label>
          <Input id="bizName" value={name} onChange={(e) => setName(e.target.value)} placeholder={t("createBusiness.eGGlamourStudio")} className={authInput} />
        </div>

        <fieldset>
          <legend className={authLabel}>{t("createBusiness.whatKindOfBusiness")}</legend>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {featuredCategories.map((cat) => {
              const Icon = cat.icon;
              return (
                <button key={cat.id} type="button" aria-pressed={category === cat.id} onClick={() => setCategory(cat.id)} className={cn(choiceCard(category === cat.id), "flex flex-col items-center gap-2 p-3 text-center")}>
                  <Icon className="h-5 w-5" aria-hidden />
                  <span className="text-xs font-semibold leading-tight">{cat.name}</span>
                </button>
              );
            })}
          </div>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className={cn(authInput, "mt-2.5")} aria-label={t("createBusiness.otherCategory")}>
              <SelectValue placeholder={t("createBusiness.orPickAnotherCategory")} />
            </SelectTrigger>
            <SelectContent>
              {otherCategories.map((cat) => (
                <SelectItem key={cat} value={cat.toLowerCase().replace(/\s+/g, "-")}>{tOpt("category", cat)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </fieldset>

        <div>
          <label htmlFor="bizPhone" className={authLabel}>
            {t("common.phone")}{" "}<span className="font-normal text-[rgb(var(--reg-muted))]">{t("createBusiness.optional")}</span>
          </label>
          <Input id="bizPhone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t("createBusiness.eG")} className={authInput} />
        </div>

        <div>
          <label htmlFor="bizAddress" className={authLabel}>
            {t("common.address")}{" "}<span className="font-normal text-[rgb(var(--reg-muted))]">{t("createBusiness.optional")}</span>
          </label>
          <div className="relative">
            <MapPin className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[rgb(var(--reg-muted))]" aria-hidden />
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
              placeholder={t("createBusiness.searchForAnAddress")}
              className={cn(authInput, "pl-12")}
            />
          </div>
          {isSearching && <p className="mt-2 text-sm text-[rgb(var(--reg-muted))]">{t("createBusiness.searching")}</p>}
          {addressResults.length > 0 && !isSearching && (
            <ul className="mt-2 max-h-48 overflow-y-auto rounded-[14px] bg-white ring-1 ring-[rgb(var(--reg-line))]">
              {addressResults.map((addr, index) => {
                const displayName = addr.display_name || addr.name || "";
                const addressParts = displayName.split(",").slice(0, 3).join(",");
                return (
                  <li key={index}>
                    <button
                      type="button"
                      onClick={() => {
                        setAddress(displayName);
                        setLatitude(parseFloat(addr.lat));
                        setLongitude(parseFloat(addr.lon));
                        const bn = addr.address?.house_number || addr.address?.building || "";
                        if (bn) setBuildingNumber(bn);
                        setAddressSearch(addressParts);
                        setAddressResults([]);
                      }}
                      className="w-full border-b border-[rgb(var(--reg-line)/0.6)] px-4 py-3 text-left text-sm last:border-0 hover:bg-[rgb(var(--reg-canvas))]"
                    >
                      {displayName}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {address && (
          <div>
            <label htmlFor="buildingNumber" className={authLabel}>{t("createBusiness.buildingNumber")}</label>
            <Input id="buildingNumber" value={buildingNumber} onChange={(e) => setBuildingNumber(e.target.value)} placeholder={t("createBusiness.eG2")} className={authInput} />
          </div>
        )}

        <div>
          <p className={authLabel}>{t("createBusiness.pinTheExactSpotOn")}</p>
          <div className="overflow-hidden rounded-[14px] ring-1 ring-[rgb(var(--reg-line))]">
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
          </div>
          {latitude && longitude && (
            <p className="mt-1.5 text-xs text-[rgb(var(--reg-muted))]">{t("createBusiness.pinnedAt", { value: latitude.toFixed(5), value2: longitude.toFixed(5) })}</p>
          )}
        </div>

        <div className="flex flex-col-reverse gap-3 sm:flex-row">
          <Link to="/?switch=1" className={cn(authGhost, "sm:flex-1")}>
            <ArrowLeft className="h-4 w-4" aria-hidden />{" "}{t("common.cancel")}
          </Link>
          <button type="submit" disabled={!canCreate} className={cn(brandCta, "sm:flex-[1.6]")}>
            {creating ? t("common.creating") : t("createBusiness.createBusiness")}
          </button>
        </div>
      </form>
    </AuthShell>
  );
}
