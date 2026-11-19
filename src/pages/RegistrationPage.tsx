import type { Id } from "@/types/id";
import { API_BASE_URL } from '@/config/api';
import { useState, useEffect, useRef, useMemo } from "react";
import { useMarket } from "@/services/platformService";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { AuthShell } from "@/components/auth/AuthShell";
import { SalonPreview } from "@/components/auth/SalonPreview";
import { authGhost, authInput, authLink, authSubtitle, authTitle, brandCta, choiceCard, webUrl } from "@/components/auth/authStyles";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Mail, ArrowLeft, Check, ChevronRight, Sparkles, Scissors, 
  Heart, Stethoscope, MapPin, X, Plus, Minus, Eye, EyeOff, User, Bell, 
  DollarSign, Building2, Clock, Users, Settings, CheckCircle2
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { categoryService, type BusinessCategory } from "@/services/categoryService";
import AddressMapPicker from "@/components/AddressMapPicker";
import { authService } from "@/services/authService";
import { businessService } from "@/services/businessService";
import { serviceService } from "@/services/serviceService";
import { staffService } from "@/services/staffService";
import { getPlatformSettings } from "@/services/platformService";
import { TERMS_VERSION } from "@/config/legal";
import { t as tr, tOpt } from "@/i18n";
import { salonPath } from "@/lib/salonKey";

interface RegistrationData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  phonePrefix: string;
  password: string;
  passwordConfirmation: string;
  language: string;
  country: string;
  /** ISO 3166-1 alpha-2 from the picked address; "" when unknown (typed by hand). */
  countryCode: string;
  termsAccepted: boolean;
  marketing1: boolean;
  category: string;
  businessName: string;
  yourName: string;
  phoneVerified: boolean;
  weeklySchedule: string;
  workLocation: string;
  referralCode: string;
  address: string;
  buildingNumber: string;
  apartmentNumber: string;
  latitude: number | null;
  longitude: number | null;
  businessHours: {
    [key: string]: { enabled: boolean; hours: string };
  };
  teamSize: string;
  staffMembers: Array<{
    id: string;
    name: string;
    email: string;
    phone: string;
    position: string;
  }>;
  services: Array<{
    id: string;
    name: string;
    type: string;
    duration: string;
    price: string;
    priceType: string;
  }>;
  helpOptions: string[];
  previousTools: string[];
  hasUsedTools: string;
  profileLiveDate: string;
}

const PHONE_PREFIXES: [string, string][] = [
  ["+1", "US/CA"], ["+7", "RU/KZ"], ["+31", "NL"], ["+32", "BE"], ["+33", "FR"], ["+34", "ES"], ["+36", "HU"], ["+39", "IT"], ["+41", "CH"], ["+43", "AT"], ["+44", "UK"], ["+45", "DK"], ["+46", "SE"], ["+47", "NO"], ["+48", "PL"], ["+49", "DE"], ["+90", "TR"], ["+353", "IE"], ["+358", "FI"], ["+370", "LT"], ["+371", "LV"], ["+372", "EE"], ["+380", "UA"], ["+420", "CZ"], ["+966", "SA"], ["+971", "AE"], ["+992", "TJ"], ["+994", "AZ"], ["+995", "GE"], ["+998", "UZ"],
];

/** The code the web landing page (/r/<code>) stored for sign-up, if any. */
function readRefCookie(): string {
  try {
    const m = document.cookie.match(/(?:^|;\s*)bq_ref=([A-Za-z0-9]{1,16})/);
    return m ? m[1] : "";
  } catch {
    return "";
  }
}

const RegistrationPage = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  // The back office can close business signups. Nothing read that setting, so the switch
  // did nothing; this is the panel half of it.
  // null = not known yet; never assume open, or the form shows and then refuses on submit.
  const [signupsOpen, setSignupsOpen] = useState<boolean | null>(null);

  useEffect(() => {
    getPlatformSettings().then((settings) => setSignupsOpen(settings.businessSignupsOpen));
  }, []);

  // Handoff from booqi-web's "For business" sign-up: ?email= and ?business= prefill the form,
  // ?plan= is shown back to the owner. All optional; anything odd is simply ignored.
  const [searchParams] = useSearchParams();
  const emailParam = (searchParams.get("email") ?? "").trim().slice(0, 254);
  const prefillEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailParam) ? emailParam : "";
  const prefillBusiness = (searchParams.get("business") ?? "").trim().slice(0, 120);
  const planParam = (searchParams.get("plan") ?? "").trim();
  // The one referral code: ?ref=<code> from a share link (getbooqi.tech/r/<code>), else the
  // bq_ref cookie the landing page left on .getbooqi.tech. Sent in the sign-up body.
  const refParam = (searchParams.get("ref") || readRefCookie()).trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 16);
  const selectedPlan = /^[a-z0-9-]{1,24}$/i.test(planParam)
    ? planParam.charAt(0).toUpperCase() + planParam.slice(1).toLowerCase()
    : null;

  const [formData, setFormData] = useState<RegistrationData>({
    // null, not missing: step 3 checks `latitude !== null`, and undefined passed that check,
    // so an address typed without picking a suggestion went through with no coordinates.
    latitude: null,
    longitude: null,
    firstName: "",
    lastName: "",
    email: prefillEmail,
    phone: "",
    phonePrefix: "",
    password: "",
    passwordConfirmation: "",
    language: "English",
    // Was a hidden, hardcoded "Poland" sent for every salon wherever it was. It now comes
    // from the address the owner picks, and the server works it out from the pin anyway.
    country: "",
    countryCode: "",
    termsAccepted: false,
    marketing1: false,
    category: "",
    businessName: prefillBusiness,
    yourName: "",
    phoneVerified: false,
    weeklySchedule: "",
    workLocation: "",
    referralCode: "",
    address: "",
    buildingNumber: "",
    apartmentNumber: "",
    businessHours: {
      monday: { enabled: true, hours: "10:00 - 19:00" },
      tuesday: { enabled: true, hours: "10:00 - 19:00" },
      wednesday: { enabled: true, hours: "10:00 - 19:00" },
      thursday: { enabled: true, hours: "10:00 - 19:00" },
      friday: { enabled: true, hours: "10:00 - 19:00" },
      saturday: { enabled: false, hours: "Closed" },
      sunday: { enabled: false, hours: "Closed" },
    },
    teamSize: "",
    staffMembers: [],
    services: [],
    helpOptions: [],
    previousTools: [],
    hasUsedTools: "",
    profileLiveDate: "3-days",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirmation, setShowPasswordConfirmation] = useState(false);
  const [verificationCode, setVerificationCode] = useState(["", "", "", ""]);
  const [resendTimer, setResendTimer] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const searchAddressRef = useRef<NodeJS.Timeout | null>(null);
  // #56: set when the address lookup is unreachable, so the wizard can tell the user to
  // type the address and building number by hand instead of silently going nowhere.
  const [geocodeUnavailable, setGeocodeUnavailable] = useState(false);
  const [supportedCountries, setSupportedCountries] = useState<{ code: string }[]>([]);
  useEffect(() => {
    getPlatformSettings()
      .then((p) => setSupportedCountries(p.countries ?? []))
      .catch(() => setSupportedCountries([]));
  }, []);
  const [addressSearch, setAddressSearch] = useState("");
  const [selectedAddress, setSelectedAddress] = useState("");
  const [additionalDetails, setAdditionalDetails] = useState("");
  const [addressResults, setAddressResults] = useState<{ display_name?: string; name?: string; lat: string; lon: string; address?: { country?: string; country_code?: string; house_number?: string; building?: string } }[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [editingDay, setEditingDay] = useState<string | null>(null);
  const [tempStartTime, setTempStartTime] = useState("10:00");
  const [tempEndTime, setTempEndTime] = useState("19:00");
  const [isAddServiceOpen, setIsAddServiceOpen] = useState(false);
  const [isAddStaffOpen, setIsAddStaffOpen] = useState(false);
  const [newService, setNewService] = useState({ name: "", type: "", durationHours: "0", durationMinutes: "30", price: "", priceType: "Fixed" });
  const [newStaff, setNewStaff] = useState({ name: "", email: "", phone: "", phonePrefix: "", position: "" });

  // The dial code follows the market (the pinned country, else the visitor's), until the
  // owner picks one by hand. Never a hardcoded country.
  const market = useMarket(formData.countryCode || null);
  const prefixTouched = useRef(false);
  useEffect(() => {
    if (!market?.dialCode || prefixTouched.current) return;
    setFormData((f) => ({ ...f, phonePrefix: market.dialCode }));
    setNewStaff((n) => ({ ...n, phonePrefix: market.dialCode }));
  }, [market]);
  const phonePrefixes = useMemo<[string, string][]>(() => {
    const first = market?.dialCode ? PHONE_PREFIXES.filter(([c]) => c === market.dialCode) : [];
    return [...first, ...PHONE_PREFIXES.filter(([c]) => c !== market?.dialCode)];
  }, [market]);

  const addressSuggestions = [
    { id: "1", street: "Karola Bunscha", city: "Kraków", country: "Poland" },
    { id: "2", street: "Karola Dickensa", city: "Warsaw", country: "Poland" },
    { id: "3", street: "Karola Taylora", city: "Warsaw", country: "Poland" },
  ];

  // The first six from the same backend list, so the tiles and the dropdown can never
  // offer different spellings of the same trade. Icons are ours; the names are not.
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
  const [otherCategories, setOtherCategories] = useState<BusinessCategory[]>([]);
  useEffect(() => {
    categoryService.list().then(setOtherCategories).catch(() => setOtherCategories([]));
  }, []);
  const featuredCategories = otherCategories.slice(0, 6).map((c) => ({
    id: c.slug,
    name: c.name,
    label: c.label ?? c.name,
    icon: CATEGORY_ICONS[c.slug] ?? Sparkles,
  }));

  // Was a hardcoded array here and a free-text box on the business profile, so the same
  // trade ended up stored three different ways. One list, from the backend.

  const helpOptions = [
    "More self-booked clients", "Selling products", "Less canceled or missed appointments",
    "Simplified payment processing", "Tracking business statistics", "Attract New Clients",
    "Engage clients", "Social media integration", "Improve financial performance", "Other",
  ];

  const businessTools = [
    "Saloner", "Wpadaj", "Bukka", "Beautymenago", "Timebox", "Fresha", "Zolmi",
    "halo24", "Traf.to", "ClickVisit", "FELG Clinic", "Square Appointments",
    "Acuity Scheduling", "Calendly", "Mindbody",
  ];

  const daysOfWeek = [
    { key: "monday", label: tr("common.monday") },
    { key: "tuesday", label: tr("common.tuesday") },
    { key: "wednesday", label: tr("common.wednesday") },
    { key: "thursday", label: tr("common.thursday") },
    { key: "friday", label: tr("common.friday") },
    { key: "saturday", label: tr("common.saturday") },
    { key: "sunday", label: tr("common.sunday") },
  ];

  // One focused question per screen. `group` is the plain word shown over the progress bar.
  const screens: { key: string; group: string; title: string; subtitle?: string }[] = [
    { key: "account", group: tr("registration.groupAccount"), title: tr("registration.createYourBusinessAccount"), subtitle: tr("registration.freeToStartYouCan") },
    { key: "name", group: tr("registration.groupBusiness"), title: tr("registration.whatSYourBusinessCalled"), subtitle: tr("registration.thisIsTheNameClients") },
    { key: "category", group: tr("registration.groupBusiness"), title: tr("registration.whatDoYouDo"), subtitle: tr("registration.pickTheOneThatFits") },
    { key: "workplace", group: tr("registration.groupBusiness"), title: tr("registration.whereDoYouWork") },
    { key: "volume", group: tr("registration.groupBusiness"), title: tr("registration.howBusyIsATypical"), subtitle: tr("registration.itHelpsUsSetUp") },
    { key: "address", group: tr("registration.groupLocation"), title: tr("registration.whereCanClientsFindYou"), subtitle: tr("registration.searchForYourAddressThen") },
    { key: "hours", group: tr("registration.groupLocation"), title: tr("registration.whenAreYouOpen"), subtitle: tr("registration.tapATimeToChange") },
    { key: "team", group: tr("registration.groupTeam"), title: tr("registration.whoWorksWithYou"), subtitle: tr("registration.optionalAddPeopleAndServices") },
    { key: "goals", group: tr("registration.groupPreferences"), title: tr("registration.whatShouldBooqiHelpWith"), subtitle: tr("registration.pickUpTo") },
    { key: "launch", group: tr("registration.groupPreferences"), title: tr("registration.whenDoYouWantTo") },
    { key: "review", group: tr("registration.groupAlmostDone"), title: tr("registration.readyToOpenYourDoors"), subtitle: tr("registration.checkTheDetailsThenCreate") },
  ];

  const hasLetter = /[a-zA-Z]/.test(formData.password);
  const hasDigit = /\d/.test(formData.password);
  const hasMinLength = formData.password.length >= 8;
  const isPasswordValid = hasLetter && hasDigit && hasMinLength;
  const passwordsMatch = formData.password === formData.passwordConfirmation && formData.passwordConfirmation.length > 0;

  const updateFormData = (field: keyof RegistrationData, value: RegistrationData[keyof RegistrationData]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const searchAddress = async (query: string) => {
    if (query.length < 2) {
      setAddressResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(
        // #56: this used to call nominatim.openstreetmap.org directly, once per user IP.
        // The User-Agent header set here never left the browser — it is a forbidden
        // header, so the identification OSM's policy requires was never actually sent.
        // The backend proxy sends it, caches results and is one client instead of many.
        `${API_BASE_URL}/public/geocode?q=${encodeURIComponent(query)}`
      );
      const data = await response.json();
      setAddressResults(data);
    } catch (error) {
      console.error('Error searching address:', error);
      setAddressResults([]);
      setGeocodeUnavailable(true);
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    if (currentStep === 2 && resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    } else if (currentStep === 2 && resendTimer === 0) {
      setCanResend(true);
    }
  }, [resendTimer, currentStep]);

  const handleCodeChange = (index: number, value: string) => {
    if (value.length > 1 || !/^\d*$/.test(value)) return;
    const newCode = [...verificationCode];
    newCode[index] = value;
    setVerificationCode(newCode);
    if (value && index < 3) inputRefs.current[index + 1]?.focus();
  };

  const handleCodeKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !verificationCode[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleResendCode = () => {
    setResendTimer(60);
    setCanResend(false);
    setVerificationCode(["", "", "", ""]);
    toast.info(tr("registration.verificationCodeSent"));
  };

  const isCodeComplete = verificationCode.every(digit => digit !== "");

  const handleAddService = () => {
    if (newService.name && newService.price) {
      const duration = `${newService.durationHours}:${newService.durationMinutes.padStart(2, "0")}`;
      updateFormData("services", [
        ...formData.services,
        {
          id: Date.now().toString(),
          name: newService.name,
          type: newService.type,
          duration,
          price: newService.price,
          priceType: newService.priceType,
        }
      ]);
      setNewService({ name: "", type: "", durationHours: "0", durationMinutes: "30", price: "", priceType: "Fixed" });
      setIsAddServiceOpen(false);
      toast.success(tr("registration.serviceAdded"));
    }
  };

  const handleAddStaff = () => {
    if (newStaff.name && newStaff.email) {
      updateFormData("staffMembers", [
        ...formData.staffMembers,
        {
          id: Date.now().toString(),
          name: newStaff.name,
          email: newStaff.email,
          phone: `${newStaff.phonePrefix} ${newStaff.phone}`,
          position: newStaff.position,
        }
      ]);
      setNewStaff({ name: "", email: "", phone: "", phonePrefix: market?.dialCode || formData.phonePrefix, position: "" });
      setIsAddStaffOpen(false);
      toast.success(tr("registration.staffMemberAdded"));
    }
  };

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const phoneRegex = /^\d{6,15}$/;
  const canProceedStep1 =
    formData.firstName.trim() !== "" &&
    formData.lastName.trim() !== "" &&
    emailRegex.test(formData.email.trim()) &&
    phoneRegex.test(formData.phone.trim()) &&
    isPasswordValid &&
    passwordsMatch &&
    formData.termsAccepted;
  const canProceedStep2 = formData.businessName.trim() !== "" && 
    formData.category !== "" && formData.weeklySchedule !== "" && formData.workLocation !== "";
  // A country booqi does not operate in is refused by the server; say so here, before the
  // account is created, instead of after it when retrying would hit "email taken".
  const unsupportedCountry =
    formData.countryCode !== "" &&
    supportedCountries.length > 0 &&
    !supportedCountries.some((c) => c.code === formData.countryCode);
  const canProceedStep3 = formData.address !== "" && formData.buildingNumber.trim() !== "" && formData.latitude !== null && formData.longitude !== null && !unsupportedCountry;
  const canProceedStep4 = true; // Step 4 is now optional/skippable
  const canProceedStep5 = formData.profileLiveDate !== "";

  const [isRegistering, setIsRegistering] = useState(false);
  // Set after a successful sign-up: a calm "welcome" screen, then the calendar (still "/").
  const [registered, setRegistered] = useState(false);
  // LR-02: the welcome button goes to the overview (readiness checklist), not an empty calendar.
  const [registeredBusinessId, setRegisteredBusinessId] = useState<Id | null>(null);

  const handleCompleteRegistration = async () => {
    setIsRegistering(true);
    try {
      const fullPhone = formData.phonePrefix && formData.phone 
        ? `${formData.phonePrefix}${formData.phone.replace(/\s/g, '')}` 
        : formData.phone;

      // Register user and create business in one request (monolith)
      const authResponse = await authService.registerBusiness({
        // The terms box and the owner-tips box were checked and then thrown away; now they
        // reach the server, which keeps them (with the wording version) as proof of consent.
        consent: {
          acceptTerms: formData.termsAccepted,
          termsVersion: TERMS_VERSION,
          marketingOptIn: formData.marketing1,
          source: "hub_register",
        },
        referralCode: refParam || undefined,
        email: formData.email,
        password: formData.password,
        firstName: formData.firstName,
        lastName: formData.lastName,
        phone: fullPhone,
        businessName: formData.businessName,
        category: formData.category,
        address: formData.address,
        buildingNumber: formData.buildingNumber,
        apartmentNumber: formData.apartmentNumber,
        // No city: the picked address is the geocoder's full line, which already ends in
        // city and country. Sending a city made the server append both again, and the
        // second comma part it guessed as "city" was usually the street.
        country: formData.country,
        latitude: formData.latitude || undefined,
        longitude: formData.longitude || undefined,
        businessHours: JSON.stringify(formData.businessHours),
        weeklySchedule: formData.weeklySchedule || undefined,
        workLocation: formData.workLocation || undefined,
        teamSize: formData.teamSize || undefined,
        profileLiveDate: formData.profileLiveDate || undefined,
        helpOptions: formData.helpOptions.length > 0 ? JSON.stringify(formData.helpOptions) : undefined,
        previousTools: formData.previousTools.length > 0 ? JSON.stringify(formData.previousTools) : undefined,
        hasUsedTools: formData.hasUsedTools || undefined,
        staffMembers: formData.staffMembers.length > 0 ? JSON.stringify(formData.staffMembers) : undefined,
        services: formData.services.length > 0 ? JSON.stringify(formData.services) : undefined,
      });

      const { accessToken, refreshToken, userId, businessId, fullName, email, role } = authResponse;

      // Store tokens FIRST so apiClient can use them for the business update call below
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);

      // Build user object from auth response fields (AuthResponse has no nested user)
      const user = { id: userId, fullName, email, role };
      localStorage.setItem('user', JSON.stringify(user));

      // #6: registerBusiness() above already provisioned a business server-side (a
      // BUSINESS_OWNER always gets one — see AuthService.register / businessId on
      // AuthResponse) and returned its id. Fill in the rest of the wizard's details on
      // THAT business with an update — a second businessService.createBusiness() call
      // here used to create a duplicate, unrelated business on every single signup.
      if (!businessId) {
        throw new Error(tr("registration.registrationSucceededButNoBusiness"));
      }
      const business = await businessService.updateBusiness(businessId, {
        name: formData.businessName,
        category: formData.category || undefined,
        address: formData.address || undefined,
        country: formData.country || undefined,
        latitude: formData.latitude || undefined,
        longitude: formData.longitude || undefined,
        phone: fullPhone || undefined,
      });

      localStorage.setItem('currentBusinessId', business.id.toString());
      localStorage.setItem('currentBusiness', JSON.stringify(business));

      // Save business hours selected during registration
      const DAY_MAP: Record<string, string> = {
        monday: 'MONDAY', tuesday: 'TUESDAY', wednesday: 'WEDNESDAY',
        thursday: 'THURSDAY', friday: 'FRIDAY', saturday: 'SATURDAY', sunday: 'SUNDAY',
      };
      try {
        const hoursPayload = Object.entries(formData.businessHours).map(([day, val]) => {
          const [start, end] = val.hours.includes('-')
            ? val.hours.split('-').map((t: string) => t.trim())
            : ['09:00', '17:00'];
          return {
            dayOfWeek: DAY_MAP[day] || day.toUpperCase(),
            enabled: val.enabled,
            startTime: start,
            endTime: end,
          };
        });
        const { businessHoursService } = await import('@/services/businessHoursService');
        await businessHoursService.updateBusinessHours(business.id, hoursPayload);
      } catch {
        // Non-fatal — hours can be set later in settings
      }

      // Create services added during registration (ids kept: a solo owner offers them all)
      const createdServiceIds: Id[] = [];
      for (const svc of formData.services) {
        try {
          // duration stored as "hours:minutes" string e.g. "0:30"
          const [h, m] = svc.duration.split(':').map(Number);
          const durationMinutes = (h || 0) * 60 + (m || 0) || 60;
          const priceTypeMap: Record<string, 'FIXED' | 'FROM' | 'RANGE'> = {
            Fixed: 'FIXED', From: 'FROM', Range: 'RANGE',
          };
          const created = await serviceService.createService(business.id, {
            name: svc.name,
            durationMinutes,
            price: svc.price ? parseFloat(svc.price) : undefined,
            priceType: priceTypeMap[svc.priceType] || 'FIXED',
          });
          if (created?.id != null) createdServiceIds.push(created.id);
        } catch {
          // Non-fatal — services can be added later
        }
      }

      // Invite staff members added during registration
      for (const member of formData.staffMembers) {
        try {
          await staffService.createStaff(business.id, {
            name: member.name,
            email: member.email,
            phone: member.phone,
            position: member.position,
            inviteAndCreateAccount: true,
          });
        } catch {
          // Non-fatal — staff can be added later
        }
      }

      // LR-03: a salon with no staff is not bookable. When the owner works alone ("Just me",
      // or no team size and nobody added), add the owner as the first staff member, with the
      // services and the open hours from this wizard. No email/invite: the owner already
      // has an account. If this fails, the overview banner still says "add a staff member".
      if (formData.teamSize === "just-me" || (!formData.teamSize && formData.staffMembers.length === 0)) {
        try {
          const schedule: Record<string, string[]> = {};
          for (const [day, val] of Object.entries(formData.businessHours)) {
            if (!val.enabled) continue;
            const [start, end] = val.hours.includes('-')
              ? val.hours.split('-').map((t: string) => t.trim())
              : ['09:00', '17:00'];
            schedule[DAY_MAP[day] || day.toUpperCase()] = [start, end];
          }
          const owner = await staffService.createStaff(business.id, {
            name: `${formData.firstName} ${formData.lastName}`.trim() || formData.businessName,
            // LR-03: the owner's own sign-in email links this staff row to their account
            // (backend), so "my calendar" shows their bookings.
            email: formData.email.trim() || undefined,
            phone: fullPhone || undefined,
            schedule: Object.keys(schedule).length > 0 ? schedule : undefined,
            inviteAndCreateAccount: false,
          });
          // The create DTO has no serviceIds; services are assigned on their own endpoint.
          if (owner?.id != null && createdServiceIds.length > 0) {
            await serviceService.setStaffServiceIds(business.id, owner.id, createdServiceIds);
          }
        } catch {
          // Non-fatal — the owner can add themselves under Team later
        }
      }


      // Who invited this salon travelled in the sign-up body (recorded as SALON server-side;
      // a bad code never blocks sign-up).

      // The welcome screen's button goes on to the portal (home page).
      setRegisteredBusinessId(business.id);
      setRegistered(true);
      window.scrollTo({ top: 0 });
    } catch (error) {
      console.error('Registration error:', error);
      const e = error as { message?: string; response?: { message?: string; error?: string }; status?: number } | null;
      console.error('Error details:', {
        message: e?.message,
        response: e?.response,
        status: e?.status,
        error: error
      });
      
      // Try to extract error message from various sources
      let errorMessage = tr("registration.registrationFailedPleaseTryAgain");
      
      if (e?.message) {
        errorMessage = e.message;
      } else if (e?.response?.message) {
        errorMessage = e.response.message;
      } else if (e?.response?.error) {
        errorMessage = e.response.error;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      
      // SIGNUPS_CLOSED: the switch was turned off while this form was open.
      if (e?.status === 403) setSignupsOpen(false);
      toast.error(errorMessage);
    } finally {
      setIsRegistering(false);
    }
  };

  if (signupsOpen === null) {
    return (
      <AuthShell>
        <div aria-busy="true" className="animate-pulse space-y-4">
          <div className="h-9 w-3/4 rounded-xl bg-[rgb(var(--reg-ink)/0.06)]" />
          <div className="h-5 w-full rounded-lg bg-[rgb(var(--reg-ink)/0.06)]" />
          <div className="h-12 w-full rounded-full bg-[rgb(var(--reg-ink)/0.06)]" />
        </div>
      </AuthShell>
    );
  }

  if (!signupsOpen) {
    return (
      <AuthShell headerLink={{ label: tr("registration.logIn"), to: "/login" }}>
        <h1 className={authTitle}>{tr("registration.signupsAreClosed")}</h1>
        <p className="mb-7 mt-2 text-base leading-relaxed text-[rgb(var(--reg-muted))]">
          {tr("registration.booqiIsNotTakingNew")}
        </p>
        <button onClick={() => navigate("/login")} className={cn(brandCta, "w-full")}>
          {tr("registration.signIn")}
        </button>
      </AuthShell>
    );
  }

  const screen = screens[currentStep - 1];
  const isFirst = currentStep === 1;
  const isReview = screen.key === "review";
  const canContinue: Record<string, boolean> = {
    account: canProceedStep1,
    name: formData.businessName.trim() !== "",
    category: formData.category !== "",
    workplace: formData.workLocation !== "",
    volume: formData.weeklySchedule !== "",
    address: canProceedStep3,
    hours: canProceedStep4,
    team: true,
    goals: true,
    launch: canProceedStep5,
    review: !isRegistering,
  };
  const goTo = (n: number) => {
    setCurrentStep(n);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const goNext = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!canContinue[screen.key]) return;
    if (isReview) handleCompleteRegistration();
    else goTo(currentStep + 1);
  };
  const screenIndex = (key: string) => screens.findIndex((s) => s.key === key) + 1;
  const ownerName = `${formData.firstName} ${formData.lastName}`.trim();
  const openDays = Object.values(formData.businessHours).filter((d) => d.enabled).length;
  const fieldLabel = "mb-1.5 block text-sm font-semibold text-[rgb(var(--reg-ink))]";
  const optional = <span className="font-normal text-[rgb(var(--reg-muted))]">{tr("registration.optional")}</span>;

  const preview = (
    <SalonPreview
      done={registered}
      data={{
        businessName: formData.businessName,
        category: formData.category,
        address: formData.address,
        ownerName,
        businessHours: formData.businessHours,
        services: formData.services,
        staff: formData.staffMembers,
      }}
    />
  );

  if (registered) {
    return (
      <AuthShell aside={preview} footer={false}>
        <div className="py-4 text-center md:py-6">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[linear-gradient(135deg,rgb(var(--reg-mesh-1)),rgb(var(--reg-mesh-2))_55%,rgb(var(--reg-mesh-3)))] text-[rgb(var(--reg-ink))] animate-in zoom-in-75 duration-500 motion-reduce:animate-none">
            <Check className="h-8 w-8" aria-hidden />
          </span>
          <h1 className={cn(authTitle, "mt-6")}>{tr("registration.welcomeToBooqi", { value: formData.firstName ? `, ${formData.firstName}` : "" })}</h1>
          <p className="mx-auto mt-3 max-w-sm text-base leading-relaxed text-[rgb(var(--reg-muted))]">
            {tr("registration.isSetUpOpenYour", { value: formData.businessName || tr("common.yourSalon") })}
          </p>
          <button type="button" onClick={() => navigate(registeredBusinessId ? salonPath(registeredBusinessId, "tasks") : "/")} className={cn(brandCta, "mt-8 w-full")}>
            {tr("registration.prepareMySalon")}
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </AuthShell>
    );
  }

  return (
    <>
      <AuthShell
        headerLink={{ label: tr("registration.logIn"), to: "/login" }}
        aside={preview}
        cardClassName="md:max-w-[520px]"
        mobileBarSpace
        mobileHero={currentStep === 1 ? "signup" : false}
      >
        {/* Progress: one thin bar and a plain count, so six-plus screens never feel long. */}
        <div className="mb-7">
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold text-[rgb(var(--reg-brand-strong))]">{screen.group}</span>
            <span className="text-[rgb(var(--reg-muted))]">
              {tr("registration.of", { currentStep, count: screens.length })}
            </span>
          </div>
          <div
            className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-[rgb(var(--reg-ink)/0.06)]"
            role="progressbar"
            aria-label={tr("registration.signUpProgress")}
            aria-valuemin={1}
            aria-valuemax={screens.length}
            aria-valuenow={currentStep}
          >
            <div
              className="h-full rounded-full bg-[linear-gradient(90deg,rgb(var(--reg-brand)),rgb(var(--reg-mesh-2)))] transition-[width] duration-500 ease-out"
              style={{ width: `${(currentStep / screens.length) * 100}%` }}
            />
          </div>
          {selectedPlan && isFirst && (
            <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-[rgb(var(--reg-brand)/0.1)] px-3 py-1.5 text-sm font-semibold text-[rgb(var(--reg-brand-strong))]">
              <span className="h-1.5 w-1.5 rounded-full bg-[rgb(var(--reg-brand))]" aria-hidden />
              {tr("registration.planSelected", { selectedPlan })}
            </p>
          )}
        </div>

        <form onSubmit={goNext} noValidate>
          <div key={screen.key} className="animate-in fade-in-0 slide-in-from-right-3 duration-300 motion-reduce:animate-none">
            <h1 className={authTitle}>{screen.title}</h1>
            {screen.subtitle && <p className={authSubtitle}>{screen.subtitle}</p>}
            {!screen.subtitle && <div className="mb-7" />}

            {screen.key === "account" && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="firstName" className={fieldLabel}>{tr("registration.firstName")}</label>
                    <Input id="firstName" autoComplete="given-name" value={formData.firstName} onChange={(e) => updateFormData("firstName", e.target.value)} className={authInput} />
                  </div>
                  <div>
                    <label htmlFor="lastName" className={fieldLabel}>{tr("registration.lastName")}</label>
                    <Input id="lastName" autoComplete="family-name" value={formData.lastName} onChange={(e) => updateFormData("lastName", e.target.value)} className={authInput} />
                  </div>
                </div>
                <div>
                  <label htmlFor="email" className={fieldLabel}>{tr("registration.emailAddress")}</label>
                  <Input id="email" type="email" inputMode="email" autoComplete="email" value={formData.email} onChange={(e) => updateFormData("email", e.target.value)} className={authInput} />
                </div>
                <div>
                  <label htmlFor="phone" className={fieldLabel}>{tr("registration.mobileNumber")}</label>
                  <div className="flex gap-2">
                    <Select value={formData.phonePrefix} onValueChange={(v) => { prefixTouched.current = true; updateFormData("phonePrefix", v); }}>
                      <SelectTrigger aria-label={tr("registration.countryCode")} className={cn(authInput, "w-[104px] shrink-0 px-3")}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {phonePrefixes.map(([code, label]) => (
                          <SelectItem key={code} value={code}>{code} ({label})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input id="phone" type="tel" inputMode="tel" autoComplete="tel-national" value={formData.phone} onChange={(e) => updateFormData("phone", e.target.value)} className={cn(authInput, "min-w-0 flex-1")} />
                  </div>
                </div>
                <div>
                  <label htmlFor="password" className={fieldLabel}>{tr("registration.password")}</label>
                  <div className="relative">
                    <Input id="password" type={showPassword ? "text" : "password"} autoComplete="new-password" value={formData.password} onChange={(e) => updateFormData("password", e.target.value)} className={cn(authInput, "pr-12")} />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? tr("registration.hidePassword") : tr("registration.showPassword")} aria-pressed={showPassword} className="absolute inset-y-0 right-1 my-auto flex h-10 w-10 items-center justify-center rounded-full text-[rgb(var(--reg-muted))] hover:text-[rgb(var(--reg-ink))]">
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                  <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1" aria-live="polite">
                    {[[hasMinLength, tr("registration.minChars")], [hasLetter, tr("registration.aLetter")], [hasDigit, tr("registration.aNumber")]].map(([ok, label]) => (
                      <li key={label as string} className={cn("flex items-center gap-1.5 text-sm", ok ? "text-[rgb(22_128_61)]" : "text-[rgb(var(--reg-muted))]")}>
                        <span className={cn("flex h-4 w-4 items-center justify-center rounded-full border", ok ? "border-[rgb(22_128_61)] bg-[rgb(22_128_61)] text-white" : "border-[rgb(var(--reg-line))]")}>
                          {ok && <Check className="h-3 w-3" aria-hidden />}
                        </span>
                        {label as string}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <label htmlFor="passwordConfirmation" className={fieldLabel}>{tr("registration.repeatPassword")}</label>
                  <div className="relative">
                    <Input
                      id="passwordConfirmation"
                      type={showPasswordConfirmation ? "text" : "password"}
                      autoComplete="new-password"
                      value={formData.passwordConfirmation}
                      onChange={(e) => updateFormData("passwordConfirmation", e.target.value)}
                      aria-invalid={(formData.passwordConfirmation && !passwordsMatch) || undefined}
                      aria-describedby="pw-match"
                      className={cn(authInput, "pr-12", formData.passwordConfirmation && !passwordsMatch && "border-red-600 focus:border-red-600 focus:ring-red-600/10 focus-visible:border-red-600 focus-visible:ring-red-600/10")}
                    />
                    <button type="button" onClick={() => setShowPasswordConfirmation(!showPasswordConfirmation)} aria-label={showPasswordConfirmation ? tr("registration.hidePassword") : tr("registration.showPassword")} aria-pressed={showPasswordConfirmation} className="absolute inset-y-0 right-1 my-auto flex h-10 w-10 items-center justify-center rounded-full text-[rgb(var(--reg-muted))] hover:text-[rgb(var(--reg-ink))]">
                      {showPasswordConfirmation ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                  <p id="pw-match" className="mt-1.5 text-sm" aria-live="polite">
                    {formData.passwordConfirmation && !passwordsMatch && <span className="text-red-700">{tr("registration.passwordsDoNotMatch")}</span>}
                  </p>
                </div>
                <div className="space-y-3 pt-1">
                  <div className="flex items-start gap-3">
                    <Checkbox id="terms" checked={formData.termsAccepted} onCheckedChange={(checked) => updateFormData("termsAccepted", checked)} className="mt-0.5 h-5 w-5 rounded-md border-[rgb(var(--reg-line))] data-[state=checked]:border-[rgb(var(--reg-brand))] data-[state=checked]:bg-[rgb(var(--reg-brand))]" />
                    <Label htmlFor="terms" className="cursor-pointer text-sm font-normal leading-relaxed text-[rgb(var(--reg-muted))]">
                      {tr("registration.iAgreeToThe")}{" "}
                      <a href={`${webUrl}/legal/terms`} target="_blank" rel="noreferrer" className={authLink}>{tr("registration.terms")}</a>,{" "}
                      <a href={`${webUrl}/legal/salon-terms`} target="_blank" rel="noreferrer" className={authLink}>{tr("registration.termsForSalons")}</a>{" "}{tr("registration.and")}{" "}
                      <a href={`${webUrl}/legal/privacy`} target="_blank" rel="noreferrer" className={authLink}>{tr("registration.privacyPolicy")}</a>
                    </Label>
                  </div>
                  <div className="flex items-start gap-3">
                    <Checkbox id="marketing1" checked={formData.marketing1} onCheckedChange={(checked) => updateFormData("marketing1", checked)} className="mt-0.5 h-5 w-5 rounded-md border-[rgb(var(--reg-line))] data-[state=checked]:border-[rgb(var(--reg-brand))] data-[state=checked]:bg-[rgb(var(--reg-brand))]" />
                    <Label htmlFor="marketing1" className="cursor-pointer text-sm font-normal leading-relaxed text-[rgb(var(--reg-muted))]">
                      {tr("registration.sendMeTipsAndNews")}{" "}{optional}
                    </Label>
                  </div>
                </div>
                <p className="pt-1 text-sm text-[rgb(var(--reg-muted))]">
                  {tr("registration.alreadyOnBooqi")}{" "}
                  <Link to="/login" className={authLink}>{tr("registration.logIn")}</Link>
                </p>
              </div>
            )}

            {screen.key === "name" && (
              <div className="space-y-4">
                <div>
                  <label htmlFor="businessName" className="sr-only">{tr("common.businessName")}</label>
                  <Input
                    id="businessName"
                    autoFocus
                    autoComplete="organization"
                    placeholder={tr("registration.eGLaleBeautyStudio")}
                    value={formData.businessName}
                    onChange={(e) => updateFormData("businessName", e.target.value)}
                    className={cn(authInput, "h-14 text-lg font-semibold")}
                  />
                </div>
                <details className="group" open={formData.referralCode !== "" || undefined}>
                  <summary className={cn(authLink, "inline-block cursor-pointer list-none text-sm")}>{tr("registration.haveAReferralCode")}</summary>
                  <div className="mt-3">
                    <label htmlFor="referralCode" className={fieldLabel}>{tr("registration.referralCode")}{" "}{optional}</label>
                    <Input id="referralCode" value={formData.referralCode} onChange={(e) => updateFormData("referralCode", e.target.value)} className={authInput} />
                  </div>
                </details>
              </div>
            )}

            {screen.key === "category" && (
              <div className="space-y-4">
                {/* Stores the name, matching the backend list. The tiles used to store their
                    own id, so a salon picking one was filed under a slug the dropdown and the
                    customer app never used. */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {featuredCategories.map((cat) => {
                    const Icon = cat.icon;
                    const on = formData.category === cat.name;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        aria-pressed={on}
                        onClick={() => updateFormData("category", cat.name)}
                        className={cn(choiceCard(on), "min-h-[96px] flex-col items-start justify-between gap-3 p-4")}
                      >
                        <Icon className={cn("h-6 w-6", on ? "text-[rgb(var(--reg-brand-strong))]" : "text-[rgb(var(--reg-muted))]")} aria-hidden />
                        <span className="text-sm leading-tight">{cat.label}</span>
                      </button>
                    );
                  })}
                </div>
                <Select value={formData.category} onValueChange={(v) => updateFormData("category", v)}>
                  <SelectTrigger aria-label={tr("registration.otherCategory")} className={authInput}>
                    <SelectValue placeholder={tr("registration.somethingElsePickFromThe")} />
                  </SelectTrigger>
                  <SelectContent>
                    {/* The name, not a slug: the wizard used to store "hair-salons" while the
                        profile stored "Hair Salon", and the customer app showed both. */}
                    {otherCategories.map((cat) => (
                      <SelectItem key={cat.slug} value={cat.name}>{cat.label ?? cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {screen.key === "workplace" && (
              <div className="space-y-3" role="radiogroup" aria-label={tr("registration.whereYouWork")}>
                {[
                  { v: "at-my-place", t: tr("registration.atMyPlace"), d: tr("registration.atMyPlaceDesc") },
                  { v: "at-clients-location", t: tr("registration.atClientPlace"), d: tr("registration.atClientPlaceDesc") },
                ].map((o) => {
                  const on = formData.workLocation === o.v;
                  return (
                    <button key={o.v} type="button" role="radio" aria-checked={on} onClick={() => updateFormData("workLocation", o.v)} className={cn(choiceCard(on), "py-4")}>
                      <span className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2", on ? "border-[rgb(var(--reg-brand))]" : "border-[rgb(var(--reg-line))]")}>
                        {on && <span className="h-2.5 w-2.5 rounded-full bg-[rgb(var(--reg-brand))]" />}
                      </span>
                      <span>
                        <span className="block">{o.t}</span>
                        <span className="mt-0.5 block text-sm font-normal text-[rgb(var(--reg-muted))]">{o.d}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {screen.key === "volume" && (
              <div className="space-y-2.5" role="radiogroup" aria-label={tr("registration.appointmentsAWeek")}>
                {["Just starting out", "1-4 appointments a week", "5-9 appointments a week", "10-19 appointments a week", "20+ appointments a week"].map((option) => {
                  const v = option.toLowerCase().replace(/\s+/g, "-");
                  const on = formData.weeklySchedule === v;
                  return (
                    <button key={tOpt("regVolume", option)} type="button" role="radio" aria-checked={on} onClick={() => updateFormData("weeklySchedule", v)} className={choiceCard(on)}>
                      <span className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2", on ? "border-[rgb(var(--reg-brand))]" : "border-[rgb(var(--reg-line))]")}>
                        {on && <span className="h-2.5 w-2.5 rounded-full bg-[rgb(var(--reg-brand))]" />}
                      </span>
                      {tOpt("regVolume", option)}
                    </button>
                  );
                })}
              </div>
            )}

            {screen.key === "address" && (
              <div className="space-y-4">
                <div>
                  <label htmlFor="address" className={fieldLabel}>{tr("common.address")}</label>
                  <div className="relative">
                    <MapPin className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[rgb(var(--reg-muted))]" aria-hidden />
                    <Input
                      id="address"
                      autoComplete="off"
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
                      placeholder={tr("registration.startTypingYourStreet")}
                      className={cn(authInput, "pl-11")}
                    />
                  </div>
                  {isSearching && <p className="mt-2 text-sm text-[rgb(var(--reg-muted))]">{tr("registration.searching")}</p>}
                  {addressResults.length > 0 && !isSearching && (
                    <div className="mt-2 max-h-56 overflow-y-auto rounded-2xl bg-white shadow-[0_2px_6px_rgb(var(--reg-ink)/0.05),0_18px_40px_-12px_rgb(var(--reg-ink)/0.16)] ring-1 ring-[rgb(var(--reg-ink)/0.06)]">
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
                              updateFormData("address", displayName);
                              updateFormData("latitude", lat);
                              updateFormData("longitude", lon);
                              updateFormData("country", addr.address?.country || displayName.split(",").pop()?.trim() || "");
                              updateFormData("countryCode", (addr.address?.country_code || "").toUpperCase());
                              // Extract building number from address details if available
                              const buildingNumber = addr.address?.house_number || addr.address?.building || "";
                              if (buildingNumber) updateFormData("buildingNumber", buildingNumber);
                              setAddressSearch(addressParts);
                              setAddressResults([]);
                            }}
                            className="flex w-full items-start gap-3 border-b border-[rgb(var(--reg-line)/0.6)] px-4 py-3 text-left text-sm last:border-0 hover:bg-[rgb(var(--reg-brand-soft))]"
                          >
                            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[rgb(var(--reg-muted))]" aria-hidden />
                            <span className="font-medium">{displayName}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {formData.address && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="buildingNumber" className={fieldLabel}>{tr("registration.buildingNo")}</label>
                      <Input id="buildingNumber" value={formData.buildingNumber} onChange={(e) => updateFormData("buildingNumber", e.target.value)} className={authInput} />
                    </div>
                    <div>
                      <label htmlFor="apartmentNumber" className={fieldLabel}>{tr("registration.flatUnit")}{" "}{optional}</label>
                      <Input id="apartmentNumber" value={formData.apartmentNumber} onChange={(e) => updateFormData("apartmentNumber", e.target.value)} className={authInput} />
                    </div>
                  </div>
                )}

                <div>
                  <p className={fieldLabel}>{tr("registration.checkThePin")}</p>
                  <div className="overflow-hidden rounded-2xl ring-1 ring-[rgb(var(--reg-line))]">
                    <AddressMapPicker
                      country={formData.countryCode || null}
                      onLocationSelect={(lat, lng, address, buildingNumber) => {
                        updateFormData("latitude", lat);
                        updateFormData("longitude", lng);
                        // A moved pin may be in another country; the server reads it from the
                        // pin, so drop the code taken from an earlier pick rather than trust it.
                        updateFormData("countryCode", "");
                        updateFormData("country", address ? address.split(",").pop()?.trim() || "" : "");
                        if (address) {
                          updateFormData("address", address);
                          setAddressSearch(address.split(",").slice(0, 3).join(","));
                        } else {
                          // #56: reverse geocoding failed or is unavailable. The pin still gave
                          // real coordinates, so fall back to whatever the user typed rather than
                          // leaving formData.address empty — otherwise canProceedStep3 blocks
                          // registration with no way out, because typing only sets addressSearch.
                          const typed = addressSearch.trim();
                          if (typed) updateFormData("address", typed);
                          setGeocodeUnavailable(true);
                        }
                        if (buildingNumber) updateFormData("buildingNumber", buildingNumber);
                      }}
                      selectedPosition={formData.latitude && formData.longitude ? [formData.latitude, formData.longitude] : null}
                      disabled={editingDay !== null}
                    />
                  </div>
                  {unsupportedCountry && (
                    <p role="alert" className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800 ring-1 ring-red-200">
                      {tr("registration.booqiIsNotOpenIn", { value: formData.country || tr("registration.thisCountry") })}
                    </p>
                  )}
                  {geocodeUnavailable && (
                    <p role="status" className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-amber-200">
                      {tr("registration.addressLookupIsUnavailableRight")}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      if (formData.latitude && formData.longitude) {
                        window.open(`https://www.google.com/maps?q=${formData.latitude},${formData.longitude}`, "_blank");
                      } else {
                        const fullAddress = `${formData.address} ${formData.buildingNumber || ""} ${formData.apartmentNumber || ""}`.trim();
                        window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`, "_blank");
                      }
                    }}
                    className={cn(authLink, "mt-2 inline-flex items-center gap-1.5 py-1 text-sm")}
                  >
                    <MapPin className="h-4 w-4" aria-hidden />
                    {tr("registration.openInMaps")}
                  </button>
                </div>
              </div>
            )}

            {screen.key === "hours" && (
              <ul className="divide-y divide-[rgb(var(--reg-line)/0.7)] rounded-2xl bg-white ring-1 ring-[rgb(var(--reg-line))]">
                {daysOfWeek.map((day) => {
                  const dayHours = formData.businessHours[day.key];
                  return (
                    <li key={day.key} className="flex min-h-[56px] items-center justify-between gap-3 px-4">
                      <label className="flex cursor-pointer items-center gap-3 text-[15px] font-semibold">
                        <Switch
                          checked={dayHours.enabled}
                          aria-label={tr("registration.openOn", { label: day.label })}
                          className="data-[state=checked]:bg-[rgb(var(--reg-brand))]"
                          onCheckedChange={(checked) => {
                            const newHours = { ...formData.businessHours };
                            newHours[day.key] = { enabled: checked, hours: checked ? "10:00 - 19:00" : "Closed" };
                            updateFormData("businessHours", newHours);
                          }}
                        />
                        {day.label}
                      </label>
                      {dayHours.enabled ? (
                        <button
                          type="button"
                          onClick={() => {
                            const [start, end] = dayHours.hours.split(" - ");
                            setTempStartTime(start || "10:00");
                            setTempEndTime(end || "19:00");
                            setEditingDay(day.key);
                          }}
                          className="rounded-full bg-[rgb(var(--reg-brand-soft))] px-3 py-1.5 text-sm font-semibold text-[rgb(var(--reg-brand-strong))] hover:bg-[rgb(var(--reg-brand)/0.15)]"
                          aria-label={tr("registration.hoursChange", { label: day.label, hours: dayHours.hours })}
                        >
                          {dayHours.hours}
                        </button>
                      ) : (
                        <span className="text-sm text-[rgb(var(--reg-muted))]">{tr("common.closed")}</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}

            {screen.key === "team" && (
              <div className="space-y-6">
                <div>
                  <p className={fieldLabel}>{tr("registration.teamSize")}{" "}{optional}</p>
                  <div className="grid grid-cols-2 gap-2.5">
                    {["Just me", "2-4 staff members", "5-9 staff members", "More than 10 staff members"].map((option) => {
                      const v = option.toLowerCase().replace(/\s+/g, "-");
                      const on = formData.teamSize === v;
                      return (
                        <button key={option} type="button" aria-pressed={on} onClick={() => updateFormData("teamSize", on ? "" : v)} className={cn(choiceCard(on), "justify-center text-center text-sm")}>
                          {tOpt("teamSize", option)}
                        </button>
                      );
                    })}
                  </div>
                  {formData.teamSize === "just-me" && (
                    <p className="mt-2 text-sm text-[rgb(var(--reg-muted))]">{tr("registration.justMeAsStaffHint")}</p>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">{tr("registration.people")}</p>
                    <button type="button" onClick={() => setIsAddStaffOpen(true)} className={cn(authLink, "inline-flex items-center gap-1 text-sm")}>
                      <Plus className="h-4 w-4" aria-hidden />{" "}{tr("registration.addPerson")}
                    </button>
                  </div>
                  <ul className="mt-2 space-y-2">
                    <li className="flex items-center gap-3 rounded-2xl bg-[rgb(var(--reg-ink)/0.03)] px-4 py-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[rgb(var(--reg-brand-soft))] text-xs font-bold text-[rgb(var(--reg-brand-strong))]">
                        <User className="h-4 w-4" aria-hidden />
                      </span>
                      <span className="text-sm">
                        <span className="block font-semibold">{ownerName || tr("registration.you")}</span>
                        <span className="block text-[rgb(var(--reg-muted))]">{tr("registration.owner")}</span>
                      </span>
                    </li>
                    {formData.staffMembers.map((staff) => (
                      <li key={staff.id} className="flex items-center justify-between gap-3 rounded-2xl px-4 py-3 ring-1 ring-[rgb(var(--reg-line))]">
                        <span className="min-w-0 text-sm">
                          <span className="block truncate font-semibold">{staff.name}</span>
                          <span className="block text-[rgb(var(--reg-muted))]">{staff.position || tr("common.teamMember")}</span>
                        </span>
                        <button type="button" aria-label={tr("registration.remove", { name: staff.name })} onClick={() => updateFormData("staffMembers", formData.staffMembers.filter((s) => s.id !== staff.id))} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[rgb(var(--reg-muted))] hover:bg-[rgb(var(--reg-ink)/0.05)]">
                          <X className="h-4 w-4" aria-hidden />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">{tr("common.services")}{" "}{optional}</p>
                    <button type="button" onClick={() => setIsAddServiceOpen(true)} className={cn(authLink, "inline-flex items-center gap-1 text-sm")}>
                      <Plus className="h-4 w-4" aria-hidden />{" "}{tr("registration.addService")}
                    </button>
                  </div>
                  {formData.services.length ? (
                    <ul className="mt-2 space-y-2">
                      {formData.services.map((svc) => (
                        <li key={svc.id} className="flex items-center justify-between gap-3 rounded-2xl px-4 py-3 ring-1 ring-[rgb(var(--reg-line))]">
                          <span className="min-w-0 text-sm">
                            <span className="block truncate font-semibold">{svc.name}</span>
                            <span className="block text-[rgb(var(--reg-muted))]">{svc.priceType === "From" ? tr("common.from") : ""}{svc.price}</span>
                          </span>
                          <button type="button" aria-label={tr("registration.remove", { name: svc.name })} onClick={() => updateFormData("services", formData.services.filter((s) => s.id !== svc.id))} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[rgb(var(--reg-muted))] hover:bg-[rgb(var(--reg-ink)/0.05)]">
                            <X className="h-4 w-4" aria-hidden />
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 rounded-2xl border border-dashed border-[rgb(var(--reg-line))] px-4 py-3 text-sm text-[rgb(var(--reg-muted))]">
                      {tr("registration.youCanAddYourMenu")}
                    </p>
                  )}
                </div>
              </div>
            )}

            {screen.key === "goals" && (
              <div className="space-y-6">
                <div className="flex flex-wrap gap-2">
                  {helpOptions.map((option) => {
                    const isSelected = formData.helpOptions.includes(option);
                    const canSelect = isSelected || formData.helpOptions.length < 5;
                    return (
                      <button
                        key={option}
                        type="button"
                        aria-pressed={isSelected}
                        disabled={!canSelect}
                        onClick={() =>
                          updateFormData("helpOptions", isSelected ? formData.helpOptions.filter((o) => o !== option) : [...formData.helpOptions, option])
                        }
                        className={cn(
                          "rounded-full border px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40",
                          isSelected
                            ? "border-[rgb(var(--reg-brand))] bg-[rgb(var(--reg-brand-soft))] text-[rgb(var(--reg-brand-strong))]"
                            : "border-[rgb(var(--reg-line))] bg-white hover:border-[rgb(var(--reg-brand)/0.5)]",
                        )}
                      >
                        {isSelected && <Check className="-ml-1 mr-1 inline h-4 w-4" aria-hidden />}
                        {tOpt("regHelp", option)}
                      </button>
                    );
                  })}
                </div>

                <div>
                  <p className={fieldLabel}>{tr("registration.haveYouUsedAnotherBooking")}</p>
                  <div className="grid grid-cols-2 gap-2.5">
                    {[["no", tr("common.no")], ["yes", tr("common.yes")]].map(([v, t]) => (
                      <button key={v} type="button" aria-pressed={formData.hasUsedTools === v} onClick={() => updateFormData("hasUsedTools", v)} className={cn(choiceCard(formData.hasUsedTools === v), "justify-center")}>
                        {t}
                      </button>
                    ))}
                  </div>
                  {formData.hasUsedTools === "yes" && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {businessTools.map((tool) => {
                        const on = formData.previousTools.includes(tool);
                        return (
                          <button
                            key={tool}
                            type="button"
                            aria-pressed={on}
                            onClick={() => updateFormData("previousTools", on ? formData.previousTools.filter((t) => t !== tool) : [...formData.previousTools, tool])}
                            className={cn(
                              "rounded-full border px-3 py-1.5 text-sm transition",
                              on ? "border-[rgb(var(--reg-brand))] bg-[rgb(var(--reg-brand-soft))] font-semibold text-[rgb(var(--reg-brand-strong))]" : "border-[rgb(var(--reg-line))] bg-white",
                            )}
                          >
                            {tool}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {screen.key === "launch" && (
              <div className="grid grid-cols-2 gap-2.5" role="radiogroup" aria-label={tr("registration.goLiveDate")}>
                {[["today", tr("common.today")], ["tomorrow", tr("common.tomorrow")], ["3-days", tr("registration.inDays")], ["1-week", tr("registration.inWeek")], ["2-weeks", tr("registration.inWeeks")], ["1-month", tr("registration.inMonth")]].map(([v, t]) => {
                  const on = formData.profileLiveDate === v;
                  return (
                    <button key={v} type="button" role="radio" aria-checked={on} onClick={() => updateFormData("profileLiveDate", v)} className={cn(choiceCard(on), "justify-center py-4")}>
                      {t}
                    </button>
                  );
                })}
              </div>
            )}

            {screen.key === "review" && (
              <dl className="divide-y divide-[rgb(var(--reg-line)/0.7)] rounded-2xl bg-white ring-1 ring-[rgb(var(--reg-line))]">
                {[
                  { k: "account", label: tr("registration.you"), value: `${ownerName} · ${formData.email}` },
                  { k: "name", label: tr("common.business"), value: [formData.businessName, otherCategories.find((c) => c.name === formData.category)?.label ?? formData.category].filter(Boolean).join(" · ") },
                  { k: "address", label: tr("common.address"), value: formData.address.split(",").slice(0, 3).join(",") },
                  { k: "hours", label: tr("registration.hours"), value: tr("registration.openDaysAWeek", { count: openDays }) },
                  {
                    k: "team",
                    label: tr("registration.teamServices"),
                    value: tr("registration.teamServicesSummary", { people: formData.staffMembers.length + 1, services: formData.services.length }),
                  },
                ].map((row) => (
                  <div key={row.k} className="flex items-start justify-between gap-3 px-4 py-3.5">
                    <div className="min-w-0">
                      <dt className="text-xs font-semibold uppercase tracking-wide text-[rgb(var(--reg-muted))]">{row.label}</dt>
                      <dd className="mt-0.5 break-words text-[15px] font-semibold">{row.value}</dd>
                    </div>
                    <button type="button" onClick={() => goTo(screenIndex(row.k))} className={cn(authLink, "shrink-0 py-1 text-sm")} aria-label={tr("registration.edit", { label: row.label })}>
                      {tr("common.edit")}
                    </button>
                  </div>
                ))}
              </dl>
            )}
          </div>

          {/* Back + Continue. Sticky at the bottom of a phone, inline in the card from md up. */}
          <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[rgb(var(--reg-line)/0.7)] bg-[rgb(var(--reg-canvas)/0.92)] px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl md:static md:mt-8 md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
            <div className="mx-auto flex max-w-[520px] gap-3">
              {!isFirst && (
                <button type="button" onClick={() => goTo(currentStep - 1)} className={cn(authGhost, "w-[52px] px-0 md:w-auto md:px-6")} aria-label={tr("registration.back")}>
                  <ArrowLeft className="h-5 w-5" aria-hidden />
                  <span className="hidden md:inline">{tr("registration.back")}</span>
                </button>
              )}
              <button type="submit" disabled={!canContinue[screen.key]} aria-busy={isRegistering} className={cn(brandCta, "flex-1")}>
                {isRegistering && <span aria-hidden className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />}
                {isReview
                  ? isRegistering ? tr("registration.creatingYourSalon") : tr("registration.createMySalon")
                  : screen.key === "team" && !formData.teamSize && !formData.staffMembers.length && !formData.services.length
                    ? tr("registration.skipForNow")
                    : tr("registration.continue")}
                {!isRegistering && <ChevronRight className="h-4 w-4" aria-hidden />}
              </button>
            </div>
          </div>
        </form>
      </AuthShell>


      {/* Add Service Dialog */}
      <Dialog open={isAddServiceOpen} onOpenChange={setIsAddServiceOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{tr("registration.addNewService")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{tr("registration.serviceName")}</Label>
              <Input
                value={newService.name}
                onChange={(e) => setNewService({ ...newService, name: e.target.value })}
                placeholder={tr("registration.eGHaircut")}
                className="border-gray-300"
              />
            </div>
            <div className="space-y-2">
              <Label>{tr("registration.serviceType")}</Label>
              <Input
                value={newService.type}
                onChange={(e) => setNewService({ ...newService, type: e.target.value })}
                placeholder={tr("registration.eGHairService")}
                className="border-gray-300"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{tr("registration.durationHours")}</Label>
                <Select value={newService.durationHours} onValueChange={(v) => setNewService({ ...newService, durationHours: v })}>
                  <SelectTrigger className="border-gray-300">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[0, 1, 2, 3, 4].map(h => (
                      <SelectItem key={h} value={h.toString()}>{h}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{tr("registration.durationMinutes")}</Label>
                <Select value={newService.durationMinutes} onValueChange={(v) => setNewService({ ...newService, durationMinutes: v })}>
                  <SelectTrigger className="border-gray-300">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[0, 15, 30, 45].map(m => (
                      <SelectItem key={m} value={m.toString().padStart(2, "0")}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>{tr("common.price")}</Label>
              <Input
                type="number"
                value={newService.price}
                onChange={(e) => setNewService({ ...newService, price: e.target.value })}
                placeholder="0.00"
                className="border-gray-300"
              />
            </div>
            <div className="space-y-2">
              <Label>{tr("registration.priceType")}</Label>
              <Select value={newService.priceType} onValueChange={(v) => setNewService({ ...newService, priceType: v })}>
                <SelectTrigger className="border-gray-300">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Fixed">{tr("common.fixed")}</SelectItem>
                  <SelectItem value="From">{tr("common.from2")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={() => setIsAddServiceOpen(false)} className="flex-1 border-gray-300">
                {tr("common.cancel")}
              </Button>
              <Button onClick={handleAddService} className={cn(brandCta, "flex-1 h-10")}>{tr("registration.addService2")}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Staff Dialog */}
      <Dialog open={isAddStaffOpen} onOpenChange={setIsAddStaffOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{tr("registration.addStaffMember")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{tr("common.name")}</Label>
              <Input
                value={newStaff.name}
                onChange={(e) => setNewStaff({ ...newStaff, name: e.target.value })}
                placeholder={tr("registration.fullName")}
                className="border-gray-300"
              />
            </div>
            <div className="space-y-2">
              <Label>{tr("common.email")}</Label>
              <Input
                type="email"
                value={newStaff.email}
                onChange={(e) => setNewStaff({ ...newStaff, email: e.target.value })}
                placeholder={tr("registration.emailExampleCom")}
                className="border-gray-300"
              />
            </div>
            <div className="space-y-2">
              <Label>{tr("common.phone")}</Label>
              <div className="flex gap-2">
                <Select value={newStaff.phonePrefix} onValueChange={(v) => setNewStaff({ ...newStaff, phonePrefix: v })}>
                  <SelectTrigger className="w-28 border-gray-300">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {phonePrefixes.map(([code, label]) => (
                      <SelectItem key={code} value={code}>{code} ({label})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  value={newStaff.phone}
                  onChange={(e) => setNewStaff({ ...newStaff, phone: e.target.value })}
                  placeholder="123 456 789"
                  className="flex-1 border-gray-300"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{tr("common.position")}</Label>
              <Input
                value={newStaff.position}
                onChange={(e) => setNewStaff({ ...newStaff, position: e.target.value })}
                placeholder={tr("registration.eGStylistTherapist")}
                className="border-gray-300"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={() => setIsAddStaffOpen(false)} className="flex-1 border-gray-300">
                {tr("common.cancel")}
              </Button>
              <Button onClick={handleAddStaff} className={cn(brandCta, "flex-1 h-10")}>{tr("registration.addStaff")}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Business Hours Dialog */}
      <Dialog open={editingDay !== null} onOpenChange={(open) => !open && setEditingDay(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {tr("common.edit")}{" "}{editingDay && daysOfWeek.find(d => d.key === editingDay)?.label}{" "}{tr("registration.hours")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-[rgb(var(--reg-ink))]">{tr("registration.openingTime")}</Label>
                <Input
                  type="time"
                  value={tempStartTime}
                  onChange={(e) => setTempStartTime(e.target.value)}
                  className={authInput}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-[rgb(var(--reg-ink))]">{tr("registration.closingTime")}</Label>
                <Input
                  type="time"
                  value={tempEndTime}
                  onChange={(e) => setTempEndTime(e.target.value)}
                  className={authInput}
                />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <Button 
                variant="outline" 
                onClick={() => setEditingDay(null)} 
                className="flex-1 border-gray-300"
              >
                {tr("common.cancel")}
              </Button>
              <Button 
                onClick={() => {
                  if (editingDay) {
                    const newHours = { ...formData.businessHours };
                    newHours[editingDay] = {
                      enabled: true,
                      hours: `${tempStartTime} - ${tempEndTime}`
                    };
                    updateFormData("businessHours", newHours);
                    setEditingDay(null);
                  }
                }} 
                className={cn(brandCta, "flex-1 h-10")}
              >
                {tr("common.save")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default RegistrationPage;
