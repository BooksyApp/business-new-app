import type { HubLocale } from "@/lib/hubLocale";

/**
 * W2-51: ready-made campaign messages. Picking one fills the campaign form and pre-selects its
 * segment; the salon can still edit the text before saving. Texts are written per language, not
 * translated word for word. The campaign system has no per-client language, so the hub language
 * picks the version.
 */
export type CampaignTemplateSegment = "LAPSED_60D" | "BIRTHDAY_THIS_MONTH" | "ALL_CLIENTS";

export interface CampaignTemplate {
  id: "novruz" | "womensDay" | "ramadan" | "birthday" | "winBack";
  segment: CampaignTemplateSegment;
  name: Record<HubLocale, string>;
  subject: Record<HubLocale, string>;
  body: Record<HubLocale, string>;
}

export const CAMPAIGN_TEMPLATES: CampaignTemplate[] = [
  {
    id: "novruz",
    segment: "ALL_CLIENTS",
    name: { az: "Novruz bayramı", en: "Novruz", ru: "Новруз" },
    subject: { az: "Novruz bayramınız mübarək!", en: "Happy Novruz!", ru: "С Новрузом!" },
    body: {
      az: "Novruz bayramınız mübarək! Bahar sizə gözəl əhval-ruhiyyə, yenilik və xoş anlar bəxş etsin. Bayramda özünüzə yenilik vermək istəyirsinizsə, onlayn yazılmaq bir dəqiqə çəkir.",
      en: "Happy Novruz! Wishing you a bright spring, fresh energy and good days ahead. Treat yourself to a fresh look this holiday, and booking online takes a minute.",
      ru: "С праздником Новруз! Желаем светлой весны, хорошего настроения и тёплых дней. Порадуйте себя свежим образом в праздничные дни, онлайн-запись займёт минуту.",
    },
  },
  {
    id: "womensDay",
    segment: "ALL_CLIENTS",
    name: { az: "8 Mart", en: "International Women's Day", ru: "8 Марта" },
    subject: { az: "8 Mart təbrik edirik!", en: "Happy International Women's Day!", ru: "С 8 Марта!" },
    body: {
      az: "8 Mart Beynəlxalq Qadınlar Gününüz mübarək! Sizə sağlamlıq, sevinc və hər işdə uğur arzulayırıq. Bu gün özünüzə layiq olan qayğını göstərin, onlayn yazılmaq bir dəqiqə çəkir.",
      en: "Happy International Women's Day! Wishing you health, joy and success in everything you do. Treat yourself today, and booking online takes a minute.",
      ru: "С 8 Марта! Желаем здоровья, радости и успехов во всём. Подарите себе заботу в этот день, онлайн-запись займёт минуту.",
    },
  },
  {
    id: "ramadan",
    segment: "ALL_CLIENTS",
    name: { az: "Ramazan", en: "Ramadan", ru: "Рамадан" },
    subject: { az: "Ramazan ayınız mübarək!", en: "Ramadan Mubarak", ru: "Рамадан Мубарак" },
    body: {
      az: "Ramazan ayınız mübarək! Xeyir-dua və xoş niyyətlə dolu günlər arzulayırıq. Bayram ərəfəsində özünüzə vaxt ayırmaq istəsəniz, onlayn yazılmaq bir dəqiqə çəkir.",
      en: "Ramadan Mubarak! Wishing you a peaceful month full of blessings. Before Eid, take a little time for yourself, and booking online takes a minute.",
      ru: "Рамадан Мубарак! Желаем спокойного месяца, полного благословений. Перед праздником найдите время для себя, онлайн-запись займёт минуту.",
    },
  },
  {
    id: "birthday",
    segment: "BIRTHDAY_THIS_MONTH",
    name: { az: "Ad günü", en: "Birthday", ru: "День рождения" },
    subject: { az: "Ad gününüz mübarək!", en: "Happy birthday!", ru: "С днём рождения!" },
    body: {
      az: "Ad gününüz mübarək! Sizə sağlamlıq, sevinc və ürəyinizcə olan hər şeyi arzulayırıq. Ad gününüzü özünüzə layiq qayğı ilə qeyd etmək üçün onlayn yazılmaq bir dəqiqə çəkir.",
      en: "Happy birthday! Wishing you health, joy and everything your heart wants. Celebrate with a little self-care, and booking online takes a minute.",
      ru: "С днём рождения! Желаем здоровья, радости и всего, о чём мечтаете. Отпразднуйте с заботой о себе, онлайн-запись займёт минуту.",
    },
  },
  {
    id: "winBack",
    segment: "LAPSED_60D",
    name: { az: "Sizi darıxdıq", en: "We miss you", ru: "Мы скучаем" },
    subject: { az: "Sizi darıxdıq", en: "We miss you", ru: "Мы скучаем" },
    body: {
      az: "Sizi darıxdıq! Çoxdan görüşmürük, qapılarımız həmişə sizin üçün açıqdır. Bu həftə bir neçə rahat saat boşdur, onlayn yazılmaq bir dəqiqə çəkir.",
      en: "We miss you! It's been a while since we last saw you, and our doors are always open. A few good times are free this week, and booking online takes a minute.",
      ru: "Мы по вам скучаем! Давно не виделись, а двери нашего салона всегда открыты. На этой неделе есть свободные окошки, онлайн-запись займёт минуту.",
    },
  },
];
