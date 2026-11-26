import type { Id } from "@/types/id";
import { positionLabel } from "@/lib/positionLabel";
import { API_BASE_URL } from '@/config/api';
import { useState, useEffect, useRef, useMemo } from "react";
import { useMarket } from "@/services/platformService";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { AuthShell } from "@/components/auth/AuthShell";
import { SalonPreview } from "@/components/auth/SalonPreview";
import { authLink, authSubtitle, authTitle, brandCta, webUrl } from "@/components/auth/authStyles";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Mail, ArrowLeft, Check, ChevronRight, Sparkles, Scissors, 
  Heart, Stethoscope, MapPin, X, Plus, Minus, Eye, EyeOff, User, Bell, 
  DollarSign, Building2, Clock, Users, Settings, CheckCircle2
} from "lucide-react";
import { Avatar, Btn, CheckRow, ChipRow, Field, FooterBar, FormGrid, Note, RadioGroup, RowItem, SelectField } from "@/components/bz";
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
        {/* Progress (BF77): one segment per screen, group + count, plain. */}
        <div className="mb-7">
          <div
            style={{ display: "flex", gap: 4 }}
            role="progressbar"
            aria-label={tr("registration.signUpProgress")}
            aria-valuemin={1}
            aria-valuemax={screens.length}
            aria-valuenow={currentStep}
          >
            {screens.map((sc, i) => (
              <i key={sc.key} style={{ flex: 1, height: 5, borderRadius: 9, background: i < currentStep ? "var(--bz-violet)" : "var(--bz-line)" }} />
            ))}
          </div>
          <div className="row sp" style={{ marginTop: 14 }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: "var(--bz-vtext)", textTransform: "uppercase", letterSpacing: ".06em" }}>{screen.group}</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: "var(--bz-muted)" }}>
              {tr("registration.of", { currentStep, count: screens.length })}
            </span>
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
              <div className="stk">
                <FormGrid cols={2}>
                  <Field label={tr("registration.firstName")} required>
                    <input id="firstName" autoComplete="given-name" value={formData.firstName} onChange={(e) => updateFormData("firstName", e.target.value)} />
                  </Field>
                  <Field label={tr("registration.lastName")} required>
                    <input id="lastName" autoComplete="family-name" value={formData.lastName} onChange={(e) => updateFormData("lastName", e.target.value)} />
                  </Field>
                </FormGrid>
                <Field label={tr("registration.emailAddress")} required>
                  <input id="email" type="email" inputMode="email" autoComplete="email" value={formData.email} onChange={(e) => updateFormData("email", e.target.value)} />
                </Field>
                <FormGrid cols={2}>
                  <SelectField label={tr("registration.countryCode")}>
                    <Select value={formData.phonePrefix} onValueChange={(v) => { prefixTouched.current = true; updateFormData("phonePrefix", v); }}>
                      <SelectTrigger aria-label={tr("registration.countryCode")} className="h-auto border-0 bg-transparent p-0 font-bold shadow-none focus:ring-0">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {phonePrefixes.map(([code, label]) => (
                          <SelectItem key={code} value={code}>{code} ({label})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </SelectField>
                  <Field label={tr("registration.mobileNumber")} required>
                    <input id="phone" type="tel" inputMode="tel" autoComplete="tel-national" value={formData.phone} onChange={(e) => updateFormData("phone", e.target.value)} />
                  </Field>
                </FormGrid>
                <Field
                  label={tr("registration.password")}
                  required
                  suffix={
                    <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? tr("registration.hidePassword") : tr("registration.showPassword")} aria-pressed={showPassword} style={{ border: 0, background: "none", padding: 0, cursor: "pointer", color: "inherit" }}>
                      {showPassword ? <EyeOff className="ic" /> : <Eye className="ic" />}
                    </button>
                  }
                >
                  <input id="password" type={showPassword ? "text" : "password"} autoComplete="new-password" value={formData.password} onChange={(e) => updateFormData("password", e.target.value)} />
                </Field>
                <div className="row gap12" aria-live="polite" style={{ flexWrap: "wrap" }}>
                  {[[hasMinLength, tr("registration.minChars")], [hasLetter, tr("registration.aLetter")], [hasDigit, tr("registration.aNumber")]].map(([ok, label]) => (
                    <span key={label as string} className="row gap8" style={{ fontSize: 14, fontWeight: 700, color: ok ? "var(--bz-ok)" : "var(--bz-muted)" }}>
                      {ok ? <Check className="ic" aria-hidden /> : <span aria-hidden style={{ width: 16, height: 16, borderRadius: 999, border: "1.5px solid var(--bz-line)", display: "inline-block" }} />}
                      {label as string}
                    </span>
                  ))}
                </div>
                <Field
                  label={tr("registration.repeatPassword")}
                  required
                  error={formData.passwordConfirmation && !passwordsMatch ? tr("registration.passwordsDoNotMatch") : undefined}
                  suffix={
                    <button type="button" onClick={() => setShowPasswordConfirmation(!showPasswordConfirmation)} aria-label={showPasswordConfirmation ? tr("registration.hidePassword") : tr("registration.showPassword")} aria-pressed={showPasswordConfirmation} style={{ border: 0, background: "none", padding: 0, cursor: "pointer", color: "inherit" }}>
                      {showPasswordConfirmation ? <EyeOff className="ic" /> : <Eye className="ic" />}
                    </button>
                  }
                >
                  <input
                    id="passwordConfirmation"
                    type={showPasswordConfirmation ? "text" : "password"}
                    autoComplete="new-password"
                    value={formData.passwordConfirmation}
                    onChange={(e) => updateFormData("passwordConfirmation", e.target.value)}
                    aria-invalid={(formData.passwordConfirmation && !passwordsMatch) || undefined}
                  />
                </Field>
                <CheckRow
                  checked={!!formData.termsAccepted}
                  icon={<Check className="ic" />}
                  onChange={(v) => updateFormData("termsAccepted", v)}
                  label={
                    <span onClick={(e) => { if ((e.target as HTMLElement).closest("a")) e.stopPropagation(); }}>
                      {tr("registration.iAgreeToThe")}{" "}
                      <a href={`${webUrl}/legal/terms`} target="_blank" rel="noreferrer" className={authLink}>{tr("registration.terms")}</a>,{" "}
                      <a href={`${webUrl}/legal/salon-terms`} target="_blank" rel="noreferrer" className={authLink}>{tr("registration.termsForSalons")}</a>{" "}{tr("registration.and")}{" "}
                      <a href={`${webUrl}/legal/privacy`} target="_blank" rel="noreferrer" className={authLink}>{tr("registration.privacyPolicy")}</a>
                    </span>
                  }
                />
                <CheckRow
                  checked={!!formData.marketing1}
                  icon={<Check className="ic" />}
                  onChange={(v) => updateFormData("marketing1", v)}
                  label={<>{tr("registration.sendMeTipsAndNews")}{" "}{optional}</>}
                />
                <p style={{ margin: 0, fontWeight: 600, fontSize: 15 }}>
                  {tr("registration.alreadyOnBooqi")}{" "}
                  <Link to="/login" className={authLink}>{tr("registration.logIn")}</Link>
                </p>
              </div>
            )}

            {screen.key === "name" && (
              <div className="stk">
                <Field label={tr("common.businessName")}>
                  <input
                    id="businessName"
                    autoFocus
                    autoComplete="organization"
                    placeholder={tr("registration.eGLaleBeautyStudio")}
                    value={formData.businessName}
                    onChange={(e) => updateFormData("businessName", e.target.value)}
                    style={{ fontSize: 18 }}
                  />
                </Field>
                <details className="group" open={formData.referralCode !== "" || undefined}>
                  <summary className={cn(authLink, "inline-block cursor-pointer list-none text-sm")}>{tr("registration.haveAReferralCode")}</summary>
                  <div className="mt-3">
                    <Field label={<>{tr("registration.referralCode")}{" "}{optional}</>}>
                      <input id="referralCode" value={formData.referralCode} onChange={(e) => updateFormData("referralCode", e.target.value)} />
                    </Field>
                  </div>
                </details>
              </div>
            )}

            {screen.key === "category" && (
              <div className="stk">
                {/* Stores the name, matching the backend list. The tiles used to store their
                    own id, so a salon picking one was filed under a slug the dropdown and the
                    customer app never used. */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                  {featuredCategories.map((cat) => {
                    const Icon = cat.icon;
                    const on = formData.category === cat.name;
                    return (
                      <div
                        key={cat.id}
                        role="button"
                        tabIndex={0}
                        aria-pressed={on}
                        className={cn("rd", on && "on")}
                        style={{ flexDirection: "column", alignItems: "center", textAlign: "center", padding: "18px 10px", minHeight: 96, justifyContent: "center" }}
                        onClick={() => updateFormData("category", cat.name)}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); updateFormData("category", cat.name); } }}
                      >
                        <Icon className="ic" aria-hidden />
                        <b>{cat.label}</b>
                      </div>
                    );
                  })}
                </div>
                <SelectField label={tr("registration.otherCategory")}>
                  <Select value={formData.category} onValueChange={(v) => updateFormData("category", v)}>
                    <SelectTrigger aria-label={tr("registration.otherCategory")} className="h-auto border-0 bg-transparent p-0 font-bold shadow-none focus:ring-0">
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
                </SelectField>
              </div>
            )}

            {screen.key === "workplace" && (
              <RadioGroup
                value={formData.workLocation}
                onChange={(v) => updateFormData("workLocation", v)}
                options={[
                  { value: "at-my-place", label: tr("registration.atMyPlace"), hint: tr("registration.atMyPlaceDesc") },
                  { value: "at-clients-location", label: tr("registration.atClientPlace"), hint: tr("registration.atClientPlaceDesc") },
                ]}
              />
            )}

            {screen.key === "volume" && (
              <RadioGroup
                value={formData.weeklySchedule}
                onChange={(v) => updateFormData("weeklySchedule", v)}
                options={["Just starting out", "1-4 appointments a week", "5-9 appointments a week", "10-19 appointments a week", "20+ appointments a week"].map((option) => ({
                  value: option.toLowerCase().replace(/\s+/g, "-"),
                  label: tOpt("regVolume", option),
                }))}
              />
            )}

            {screen.key === "address" && (
              <div className="stk">
                <div>
                  <Field label={tr("common.address")} suffix={<MapPin className="ic" aria-hidden />}>
                    <input
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
                    />
                  </Field>
                  {isSearching && <p className="hint mt-2">{tr("registration.searching")}</p>}
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
                  <FormGrid cols={2}>
                    <Field label={tr("registration.buildingNo")}>
                      <input id="buildingNumber" value={formData.buildingNumber} onChange={(e) => updateFormData("buildingNumber", e.target.value)} />
                    </Field>
                    <Field label={<>{tr("registration.flatUnit")}{" "}{optional}</>}>
                      <input id="apartmentNumber" value={formData.apartmentNumber} onChange={(e) => updateFormData("apartmentNumber", e.target.value)} />
                    </Field>
                  </FormGrid>
                )}

                <div>
                  <div className="lbl2" style={{ marginBottom: 8 }}>{tr("registration.checkThePin")}</div>
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
                    <div role="alert" style={{ marginTop: 8 }}><Note kind="er">{tr("registration.booqiIsNotOpenIn", { value: formData.country || tr("registration.thisCountry") })}</Note></div>
                  )}
                  {geocodeUnavailable && (
                    <div role="status" style={{ marginTop: 8 }}><Note kind="wa">{tr("registration.addressLookupIsUnavailableRight")}</Note></div>
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
              <div className="stk">
                {daysOfWeek.map((day) => {
                  const dayHours = formData.businessHours[day.key];
                  return (
                    <div key={day.key} className="swr">
                      <div><b>{day.label}</b></div>
                      <div className="row gap8">
                        {dayHours.enabled ? (
                          <button
                            type="button"
                            onClick={() => {
                              const [start, end] = dayHours.hours.split(" - ");
                              setTempStartTime(start || "10:00");
                              setTempEndTime(end || "19:00");
                              setEditingDay(day.key);
                            }}
                            className="chip on"
                            aria-label={tr("registration.hoursChange", { label: day.label, hours: dayHours.hours })}
                          >
                            {dayHours.hours}
                          </button>
                        ) : (
                          <span className="hint">{tr("common.closed")}</span>
                        )}
                        <button
                          type="button"
                          role="switch"
                          aria-checked={dayHours.enabled}
                          aria-label={tr("registration.openOn", { label: day.label })}
                          className={cn("tg", !dayHours.enabled && "off")}
                          style={{ border: 0, padding: 0 }}
                          onClick={() => {
                            const newHours = { ...formData.businessHours };
                            newHours[day.key] = { enabled: !dayHours.enabled, hours: !dayHours.enabled ? "10:00 - 19:00" : "Closed" };
                            updateFormData("businessHours", newHours);
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {screen.key === "team" && (
              <div className="stk">
                <div className="stk">
                  <div className="lbl2">{tr("registration.teamSize")}{" "}{optional}</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    {["Just me", "2-4 staff members", "5-9 staff members", "More than 10 staff members"].map((option) => {
                      const v = option.toLowerCase().replace(/\s+/g, "-");
                      const on = formData.teamSize === v;
                      return (
                        <div
                          key={option}
                          role="button"
                          tabIndex={0}
                          aria-pressed={on}
                          className={cn("rd", on && "on")}
                          style={{ justifyContent: "center", textAlign: "center" }}
                          onClick={() => updateFormData("teamSize", on ? "" : v)}
                          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); updateFormData("teamSize", on ? "" : v); } }}
                        >
                          <b>{tOpt("teamSize", option)}</b>
                        </div>
                      );
                    })}
                  </div>
                  {formData.teamSize === "just-me" && <span className="hint">{tr("registration.justMeAsStaffHint")}</span>}
                </div>

                <div className="stk">
                  <div className="row sp">
                    <div className="lbl2">{tr("registration.people")}</div>
                    <button type="button" onClick={() => setIsAddStaffOpen(true)} className="btn btn-soft s">
                      <Plus className="ic" aria-hidden />{" "}{tr("registration.addPerson")}
                    </button>
                  </div>
                  <RowItem
                    left={<Avatar initials={(ownerName || tr("registration.you")).slice(0, 1).toUpperCase()} size={36} />}
                    title={ownerName || tr("registration.you")}
                    sub={tr("registration.owner")}
                  />
                  {formData.staffMembers.map((staff) => (
                    <RowItem
                      key={staff.id}
                      left={<Avatar initials={(staff.name || "?").slice(0, 1).toUpperCase()} size={36} />}
                      title={staff.name}
                      sub={positionLabel(staff.position) || tr("common.teamMember")}
                      right={
                        <button type="button" aria-label={tr("registration.remove", { name: staff.name })} onClick={() => updateFormData("staffMembers", formData.staffMembers.filter((s) => s.id !== staff.id))} className="circ" style={{ border: 0, cursor: "pointer" }}>
                          <X className="ic" aria-hidden />
                        </button>
                      }
                    />
                  ))}
                </div>

                <div className="stk">
                  <div className="row sp">
                    <div className="lbl2">{tr("common.services")}{" "}{optional}</div>
                    <button type="button" onClick={() => setIsAddServiceOpen(true)} className="btn btn-soft s">
                      <Plus className="ic" aria-hidden />{" "}{tr("registration.addService")}
                    </button>
                  </div>
                  {formData.services.length ? (
                    formData.services.map((svc) => (
                      <RowItem
                        key={svc.id}
                        title={svc.name}
                        sub={<>{svc.priceType === "From" ? tr("common.from") : ""}{svc.price}</>}
                        right={
                          <button type="button" aria-label={tr("registration.remove", { name: svc.name })} onClick={() => updateFormData("services", formData.services.filter((s) => s.id !== svc.id))} className="circ" style={{ border: 0, cursor: "pointer" }}>
                            <X className="ic" aria-hidden />
                          </button>
                        }
                      />
                    ))
                  ) : (
                    <Note kind="in">{tr("registration.youCanAddYourMenu")}</Note>
                  )}
                </div>
              </div>
            )}

            {screen.key === "goals" && (
              <div className="stk">
                <ChipRow>
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
                        className={cn("chip", isSelected && "on")}
                        style={{ border: 0, cursor: canSelect ? "pointer" : "not-allowed", opacity: canSelect ? 1 : 0.4 }}
                      >
                        {isSelected && <Check className="ic" aria-hidden />}
                        {tOpt("regHelp", option)}
                      </button>
                    );
                  })}
                </ChipRow>

                <RadioGroup
                  title={tr("registration.haveYouUsedAnotherBooking")}
                  value={formData.hasUsedTools}
                  onChange={(v) => updateFormData("hasUsedTools", v)}
                  options={[{ value: "no", label: tr("common.no") }, { value: "yes", label: tr("common.yes") }]}
                />
                {formData.hasUsedTools === "yes" && (
                  <ChipRow>
                    {businessTools.map((tool) => {
                      const on = formData.previousTools.includes(tool);
                      return (
                        <button
                          key={tool}
                          type="button"
                          aria-pressed={on}
                          onClick={() => updateFormData("previousTools", on ? formData.previousTools.filter((t) => t !== tool) : [...formData.previousTools, tool])}
                          className={cn("chip", on && "on")}
                          style={{ border: 0, cursor: "pointer" }}
                        >
                          {tool}
                        </button>
                      );
                    })}
                  </ChipRow>
                )}
              </div>
            )}

            {screen.key === "launch" && (
              <RadioGroup
                value={formData.profileLiveDate}
                onChange={(v) => updateFormData("profileLiveDate", v)}
                options={[["today", tr("common.today")], ["tomorrow", tr("common.tomorrow")], ["3-days", tr("registration.inDays")], ["1-week", tr("registration.inWeek")], ["2-weeks", tr("registration.inWeeks")], ["1-month", tr("registration.inMonth")]].map(([value, label]) => ({ value, label }))}
              />
            )}

            {screen.key === "review" && (
              <div className="stk">
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
                  <RowItem
                    key={row.k}
                    title={row.value}
                    sub={row.label}
                    right={
                      <button type="button" onClick={() => goTo(screenIndex(row.k))} className="btn btn-ol s" aria-label={tr("registration.edit", { label: row.label })}>
                        {tr("common.edit")}
                      </button>
                    }
                  />
                ))}
              </div>
            )}
          </div>

          {/* Back (quiet) + Continue (the single gradient primary). Sticky at the bottom of a phone, inline from md up. */}
          <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[rgb(var(--reg-line)/0.7)] bg-[rgb(var(--reg-canvas)/0.92)] px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl md:static md:mt-8 md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
            <div className="row gap8 mx-auto" style={{ maxWidth: 520 }}>
              {!isFirst && (
                <button type="button" onClick={() => goTo(currentStep - 1)} className="btn btn-ol" aria-label={tr("registration.back")}>
                  <ArrowLeft className="ic" aria-hidden />
                  <span className="hidden md:inline">{tr("registration.back")}</span>
                </button>
              )}
              <span style={{ flex: 1 }} />
              <button type="submit" disabled={!canContinue[screen.key]} aria-busy={isRegistering} className="btn btn-v">
                {isRegistering && <span aria-hidden className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />}
                {isReview
                  ? isRegistering ? tr("registration.creatingYourSalon") : tr("registration.createMySalon")
                  : screen.key === "team" && !formData.teamSize && !formData.staffMembers.length && !formData.services.length
                    ? tr("registration.skipForNow")
                    : tr("registration.continue")}
                {!isRegistering && <ChevronRight className="ic" aria-hidden />}
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
          <div className="stk">
            <Field label={tr("registration.serviceName")}>
              <input value={newService.name}
                onChange={(e) => setNewService({ ...newService, name: e.target.value })}
                placeholder={tr("registration.eGHaircut")} />
            </Field>
            <Field label={tr("registration.serviceType")}>
              <input value={newService.type}
                onChange={(e) => setNewService({ ...newService, type: e.target.value })}
                placeholder={tr("registration.eGHairService")} />
            </Field>
            <FormGrid cols={2}>
              <SelectField label={tr("registration.durationHours")}>
<Select value={newService.durationHours} onValueChange={(v) => setNewService({ ...newService, durationHours: v })}>
                  <SelectTrigger className="h-auto border-0 bg-transparent p-0 font-bold shadow-none focus:ring-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[0, 1, 2, 3, 4].map(h => (
                      <SelectItem key={h} value={h.toString()}>{h}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </SelectField>
              <SelectField label={tr("registration.durationMinutes")}>
<Select value={newService.durationMinutes} onValueChange={(v) => setNewService({ ...newService, durationMinutes: v })}>
                  <SelectTrigger className="h-auto border-0 bg-transparent p-0 font-bold shadow-none focus:ring-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[0, 15, 30, 45].map(m => (
                      <SelectItem key={m} value={m.toString().padStart(2, "0")}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </SelectField>
            </FormGrid>
            <Field label={tr("common.price")}>
              <input type="number"
                value={newService.price}
                onChange={(e) => setNewService({ ...newService, price: e.target.value })}
                placeholder="0.00" />
            </Field>
            <SelectField label={tr("registration.priceType")}>
<Select value={newService.priceType} onValueChange={(v) => setNewService({ ...newService, priceType: v })}>
                <SelectTrigger className="h-auto border-0 bg-transparent p-0 font-bold shadow-none focus:ring-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Fixed">{tr("common.fixed")}</SelectItem>
                  <SelectItem value="From">{tr("common.from2")}</SelectItem>
                </SelectContent>
              </Select>
            </SelectField>
            <FooterBar>
              <Btn kind="ol" onClick={() => setIsAddServiceOpen(false)}>{tr("common.cancel")}</Btn>
              <Btn kind="v" onClick={handleAddService}>{tr("registration.addService2")}</Btn>
            </FooterBar>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Staff Dialog */}
      <Dialog open={isAddStaffOpen} onOpenChange={setIsAddStaffOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{tr("registration.addStaffMember")}</DialogTitle>
          </DialogHeader>
          <div className="stk">
            <Field label={tr("common.name")}>
              <input value={newStaff.name}
                onChange={(e) => setNewStaff({ ...newStaff, name: e.target.value })}
                placeholder={tr("registration.fullName")} />
            </Field>
            <Field label={tr("common.email")}>
              <input type="email"
                value={newStaff.email}
                onChange={(e) => setNewStaff({ ...newStaff, email: e.target.value })}
                placeholder={tr("registration.emailExampleCom")} />
            </Field>
            <FormGrid cols={2}>
              <SelectField label={tr("registration.countryCode")}>
                <Select value={newStaff.phonePrefix} onValueChange={(v) => setNewStaff({ ...newStaff, phonePrefix: v })}>
                  <SelectTrigger className="h-auto border-0 bg-transparent p-0 font-bold shadow-none focus:ring-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {phonePrefixes.map(([code, label]) => (
                      <SelectItem key={code} value={code}>{code} ({label})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </SelectField>
              <Field label={tr("common.phone")}>
                <input
                  value={newStaff.phone}
                  onChange={(e) => setNewStaff({ ...newStaff, phone: e.target.value })}
                  placeholder="123 456 789"
                />
              </Field>
            </FormGrid>
            <Field label={tr("common.position")}>
              <input value={newStaff.position}
                onChange={(e) => setNewStaff({ ...newStaff, position: e.target.value })}
                placeholder={tr("registration.eGStylistTherapist")} />
            </Field>
            <FooterBar>
              <Btn kind="ol" onClick={() => setIsAddStaffOpen(false)}>{tr("common.cancel")}</Btn>
              <Btn kind="v" onClick={handleAddStaff}>{tr("registration.addStaff")}</Btn>
            </FooterBar>
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
          <div className="stk">
            <FormGrid cols={2}>
              <Field label={tr("registration.openingTime")}>
              <input type="time"
                value={tempStartTime}
                onChange={(e) => setTempStartTime(e.target.value)} />
            </Field>
              <Field label={tr("registration.closingTime")}>
              <input type="time"
                value={tempEndTime}
                onChange={(e) => setTempEndTime(e.target.value)} />
            </Field>
            </FormGrid>
            <FooterBar>
              <Btn kind="ol" onClick={() => setEditingDay(null)}>{tr("common.cancel")}</Btn>
              <Btn kind="v" onClick={() => {
                  if (editingDay) {
                    const newHours = { ...formData.businessHours };
                    newHours[editingDay] = {
                      enabled: true,
                      hours: `${tempStartTime} - ${tempEndTime}`
                    };
                    updateFormData("businessHours", newHours);
                    setEditingDay(null);
                  }
                }}>{tr("common.save")}</Btn>
            </FooterBar>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default RegistrationPage;
