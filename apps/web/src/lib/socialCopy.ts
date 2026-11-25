/**
 * The words on the ready-made social images. Written natively per language (Azerbaijani first),
 * not translated from one another. The image language is the salon's choice, independent of the
 * language of the hub.
 */
export type SocialLang = "az" | "en" | "ru";
export type SocialTemplate = "offer" | "slots" | "service" | "review";

export const SOCIAL_LANGS: SocialLang[] = ["az", "en", "ru"];
export const SOCIAL_TEMPLATES: SocialTemplate[] = ["offer", "slots", "service", "review"];

type L<T> = Record<SocialLang, T>;

/** The small label above the headline, per template. */
export const PILL: Record<SocialTemplate, L<string>> = {
  offer: { az: "Yeni təklif", en: "New offer", ru: "Новая акция" },
  slots: { az: "Bu gün boş saatlar", en: "Free slots today", ru: "Свободно сегодня" },
  service: { az: "Yeni xidmət", en: "New service", ru: "Новая услуга" },
  review: { az: "Müştəri rəyi", en: "Client review", ru: "Отзыв клиента" },
};

/** What each template says until the salon types its own. */
export const DEFAULTS: Record<SocialTemplate, L<{ headline: string; sub: string; extra: string }>> = {
  offer: {
    az: { headline: "Bu həftə -20%", sub: "Seçilmiş xidmətlərə endirim. Yerlər məhduddur, tez yazılın.", extra: "Təklif həftə sonuna qədər" },
    en: { headline: "20% off this week", sub: "On selected services. Spots are limited, so book early.", extra: "Offer ends Sunday" },
    ru: { headline: "-20% на этой неделе", sub: "На выбранные услуги. Мест немного, записывайтесь заранее.", extra: "Акция до воскресенья" },
  },
  slots: {
    az: { headline: "Bu gün hələ yerimiz var", sub: "Növbə gözləmədən, rahat vaxtda yazılın.", extra: "11:00, 13:30, 15:00, 17:30" },
    en: { headline: "We still have room today", sub: "Pick a time that suits you and book in a minute.", extra: "11:00, 13:30, 15:00, 17:30" },
    ru: { headline: "Сегодня ещё есть места", sub: "Выберите удобное время и запишитесь за минуту.", extra: "11:00, 13:30, 15:00, 17:30" },
  },
  service: {
    az: { headline: "Yeni xidmət: ipək manikür", sub: "Gözəl və dayanıqlı nəticə. İndi onlayn yazılmaq mümkündür.", extra: "35 AZN-dən" },
    en: { headline: "New: silk manicure", sub: "A beautiful, long-lasting finish. Now available to book online.", extra: "from 35 AZN" },
    ru: { headline: "Новинка: шёлковый маникюр", sub: "Красивый и стойкий результат. Теперь можно записаться онлайн.", extra: "от 35 AZN" },
  },
  review: {
    az: { headline: "Hər şey çox xoşuma gəldi, mütləq yenə gələcəyəm!", sub: "", extra: "Aysel" },
    en: { headline: "I loved everything, I will definitely be back!", sub: "", extra: "Aysel" },
    ru: { headline: "Всё очень понравилось, обязательно приду снова!", sub: "", extra: "Айсель" },
  },
};

export const CTA: L<string> = {
  az: "Onlayn yazılın",
  en: "Book online",
  ru: "Записаться онлайн",
};

export const SCAN: L<string> = {
  az: "QR-i oxudun",
  en: "Scan to book",
  ru: "Наведите камеру",
};

export const SLOTS_LABEL: L<string> = {
  az: "Boş saatlar",
  en: "Open times",
  ru: "Свободное время",
};
