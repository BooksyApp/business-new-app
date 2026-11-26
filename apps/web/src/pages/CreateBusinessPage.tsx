import { API_BASE_URL } from '@/config/api';
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SalonPreview } from "@/components/auth/SalonPreview";
import { Btn, BzScope, Chip, ChipRow, Field, RowItem, SelectField } from "@/components/bz";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Scissors, Heart, Stethoscope } from "lucide-react";
import { toast } from "sonner";
import AddressMapPicker from "@/components/AddressMapPicker";
import { businessService } from "@/services/businessService";
import { categoryService, type BusinessCategory } from "@/services/categoryService";
import { getCurrentUser } from "@/utils/businessUtils";
import { t } from "@/i18n";
import { salonPath } from "@/lib/salonKey";

// #9 (salon-hub QA follow-up): "Add a business" used to be a bare name field on the
// picker screen that created a business with nothing else filled in — not what an
// owner adding a second business expects. This is the same category + address/map
// picker as the registration wizard's Step 2/3, reused here as its own page (matching
// AddServicePage/AddStaffPage's "dedicated page for Add X" pattern) so a new business
// starts with real details instead of a name-only stub.

// Same backend list as the registration wizard: the server only accepts its own slugs
// (nail-salon, hair-salon, ...), so a hard-coded list here made "Create salon" fail with "Unknown category".
const CATEGORY_ICONS: Record<string, typeof Scissors> = {
  "hair-salon": Scissors,
  barbershop: Scissors,
  "nail-salon": Sparkles,
  "brows-lashes": Heart,
  "skin-care": Heart,
  massage: Heart,
  "spa-wellness": Heart,
  "aesthetic-medicine": Stethoscope,
  dental: Stethoscope,
};

export default function CreateBusinessPage() {
  const navigate = useNavigate();
  const searchAddressRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [allCategories, setAllCategories] = useState<BusinessCategory[]>([]);
  useEffect(() => {
    categoryService.list().then(setAllCategories).catch(() => setAllCategories([]));
  }, []);
  const featuredCategories = allCategories.slice(0, 6).map((c) => ({ id: c.slug, name: c.label ?? c.name, icon: CATEGORY_ICONS[c.slug] ?? Sparkles }));
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
      navigate(salonPath(business.id), { replace: true });
    } catch {
      toast.error(t("createBusiness.failedToCreateBusinessPlease"));
    } finally {
      setCreating(false);
    }
  };

  const categoryName = allCategories.find((c) => c.slug === category);
  const categoryLabel = categoryName ? (categoryName.label ?? categoryName.name) : "";
  const user = getCurrentUser();
  const preview = (
    <SalonPreview
      data={{
        businessName: name.trim(),
        category: categoryLabel,
        address: [address.split(",").slice(0, 2).join(","), buildingNumber].filter(Boolean).join(" "),
        ownerName: [user?.firstName, user?.lastName].filter(Boolean).join(" "),
        businessHours: {},
        services: [],
        staff: [],
      }}
    />
  );

  return (
    <BzScope>
      <div className="dsh bz-surface bz-live" style={{ justifyContent: "center", gap: 32, flexWrap: "wrap", padding: 30, background: "var(--bz-canvas)" }}>
        <form
          className="stk"
          style={{ width: 620, maxWidth: "100%" }}
          onSubmit={(e) => {
            e.preventDefault();
            void handleCreate();
          }}
        >
          <b style={{ fontSize: 30, letterSpacing: "-.02em" }}>{t("createBusiness.addABusiness")}</b>
          <span className="hint">{t("createBusiness.aNewSalonUnderYour")}</span>

          <Field label={t("common.businessName")} required>
            <input id="bizName" value={name} onChange={(e) => setName(e.target.value)} placeholder={t("createBusiness.eGGlamourStudio")} />
          </Field>

          <div className="lbl2">{t("createBusiness.whatKindOfBusiness")}</div>
          <ChipRow>
            {featuredCategories.map((cat) => (
              <Chip key={cat.id} violet={category === cat.id} onClick={() => setCategory(cat.id)}>
                {cat.name}
              </Chip>
            ))}
          </ChipRow>
          <SelectField label={t("createBusiness.otherCategory")}>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="h-auto border-0 bg-transparent p-0 font-bold shadow-none" aria-label={t("createBusiness.otherCategory")}>
                <SelectValue placeholder={t("createBusiness.orPickAnotherCategory")} />
              </SelectTrigger>
              <SelectContent>
                {allCategories.map((cat) => (
                  <SelectItem key={cat.slug} value={cat.slug}>{cat.label ?? cat.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SelectField>

          <Field label={`${t("common.phone")} · ${t("createBusiness.optional")}`}>
            <input id="bizPhone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t("createBusiness.eG")} />
          </Field>

          <Field label={`${t("common.address")} · ${t("createBusiness.optional")}`} hint={isSearching ? t("createBusiness.searching") : undefined}>
            <input
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
            />
          </Field>
          {addressResults.length > 0 && !isSearching && (
            <div className="tbx" style={{ maxHeight: 192, overflowY: "auto" }}>
              {addressResults.map((addr, index) => {
                const displayName = addr.display_name || addr.name || "";
                const addressParts = displayName.split(",").slice(0, 3).join(",");
                return (
                  <RowItem
                    key={index}
                    title={displayName}
                    onClick={() => {
                      setAddress(displayName);
                      setLatitude(parseFloat(addr.lat));
                      setLongitude(parseFloat(addr.lon));
                      const bn = addr.address?.house_number || addr.address?.building || "";
                      if (bn) setBuildingNumber(bn);
                      setAddressSearch(addressParts);
                      setAddressResults([]);
                    }}
                  />
                );
              })}
            </div>
          )}

          {address && (
            <Field label={t("createBusiness.buildingNumber")}>
              <input id="buildingNumber" value={buildingNumber} onChange={(e) => setBuildingNumber(e.target.value)} placeholder={t("createBusiness.eG2")} />
            </Field>
          )}

          <div className="lbl2">{t("createBusiness.pinTheExactSpotOn")}</div>
          <div className="mapx" style={{ overflow: "hidden" }}>
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
            <span className="hint">{t("createBusiness.pinnedAt", { value: latitude.toFixed(5), value2: longitude.toFixed(5) })}</span>
          )}

          <div className="row gap8" style={{ justifyContent: "flex-end" }}>
            <Btn kind="ol" onClick={() => navigate("/?switch=1")}>{t("common.cancel")}</Btn>
            <Btn kind="v" type="submit" disabled={!canCreate}>
              {creating ? t("common.creating") : t("createBusiness.createBusiness")}
            </Btn>
          </div>
        </form>
        <div style={{ width: 340, maxWidth: "100%", alignSelf: "flex-start" }}>{preview}</div>
      </div>
    </BzScope>
  );
}
