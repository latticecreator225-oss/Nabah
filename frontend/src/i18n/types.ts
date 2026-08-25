/**
 * Nabah · Interface language
 *
 * SCOPE — read before adding keys.
 * This catalogue covers the app's *interface* only: labels, buttons, headings,
 * hints. It deliberately does NOT carry religious content.
 *
 *   · Quran text + translations  → real published translations, fetched per
 *     language from alquran.cloud (see backend routers/quran.py TRANSLATIONS).
 *   · Hadith (the two Sahihs)    → real published translations, fetched per
 *     language from the hadith API (see backend routers/hadith.py).
 *   · Adhkar meanings, dua translations, Sunnah entries, daily reminders
 *     → remain English for now. These are renderings of hadith/dua meaning
 *       with no authentic published translation available to source from, and
 *       machine-translating a translation of religious text is not something
 *       this app should ship unverified. Add them per-language only from a
 *       qualified source.
 */
export type LanguageId = 'en' | 'ar' | 'ur' | 'id' | 'bn' | 'tr';

export type Language = {
  id: LanguageId;
  /** Name shown in the picker, written in that language itself. */
  label: string;
  /** English name, for the secondary line in the picker. */
  english: string;
  rtl: boolean;
  /** alquran.cloud translation edition id used by the Quran reader. */
  quranEdition: string;
  /** hadith-api language prefix (e.g. "urd" → urd-bukhari). */
  hadithPrefix: string;
};

export const LANGUAGES: Language[] = [
  { id: 'en', label: 'English',    english: 'English',    rtl: false, quranEdition: 'en.sahih',      hadithPrefix: 'eng' },
  { id: 'ar', label: 'العربية',    english: 'Arabic',     rtl: true,  quranEdition: 'en.sahih',      hadithPrefix: 'ara' },
  { id: 'ur', label: 'اردو',       english: 'Urdu',       rtl: true,  quranEdition: 'ur.jalandhry', hadithPrefix: 'urd' },
  { id: 'id', label: 'Indonesia',  english: 'Indonesian', rtl: false, quranEdition: 'id.indonesian', hadithPrefix: 'ind' },
  { id: 'bn', label: 'বাংলা',      english: 'Bengali',    rtl: false, quranEdition: 'bn.bengali',    hadithPrefix: 'ben' },
  { id: 'tr', label: 'Türkçe',     english: 'Turkish',    rtl: false, quranEdition: 'tr.diyanet',    hadithPrefix: 'tur' },
];

export function languageById(id: LanguageId): Language {
  return LANGUAGES.find((l) => l.id === id) || LANGUAGES[0];
}

/** Every interface string. English is the source of truth for the shape. */
export type Strings = {
  // ── generic actions ──
  save: string;
  saved: string;
  share: string;
  remove: string;
  cancel: string;
  listen: string;
  playing: string;
  another: string;
  tryAgain: string;
  loading: string;
  couldNotLoad: string;
  checkConnection: string;
  nothingHereYet: string;

  // ── onboarding ──
  onboardWelcome: string;
  onboardYourName: string;
  onboardNamePlaceholder: string;
  onboardAddressYou: string;
  onboardBrother: string;
  onboardSister: string;
  onboardTextSize: string;
  onboardTextSizeHint: string;
  onboardDisclaimer: string;
  onboardBegin: string;
  onboardLocationNote: string;
  onboardNameMissingTitle: string;
  onboardNameMissingBody: string;
  onboardGenderMissingTitle: string;
  onboardGenderMissingBody: string;

  // ── home ──
  homeNextPrayer: string;
  homeQuranEyebrow: string;
  homeQuranContinue: string;
  homeQuranBegin: string;
  homeQuranCaptionNew: string;
  homeQuranCaptionResume: string;
  homeTasbeeh: string;
  homeTasbeehSub: string;
  homeFeelings: string;
  homeFeelingsSub: string;
  homeAdhkar: string;
  homeAdhkarSub: string;
  homeSunnahEyebrow: string;
  homeSunnahTitle: string;
  homeSunnahCaption: string;
  homeHadithLabel: string;
  homeHadithSub: string;
  homeDuasLabel: string;
  homeDuasSub: string;
  homeRemindersLabel: string;
  homeRemindersSub: string;
  homeFallbackLocation: string;
  homeOfflineTimes: string;

  // ── prayers ──
  prayerFajr: string;
  prayerDhuhr: string;
  prayerAsr: string;
  prayerMaghrib: string;
  prayerIsha: string;
  prayerSunrise: string;

  // ── feelings ──
  feelingsTitle: string;
  feelingsFinding: string;
  feelingsWordForYou: string;
  feelingsSurah: string;

  // emotion labels
  emoSad: string;
  emoAnxious: string;
  emoAngry: string;
  emoExhausted: string;
  emoGrateful: string;
  emoHopeless: string;
  emoHappy: string;
  emoRestless: string;
  emoHeartbroken: string;
  emoLonely: string;

  // ── tasbeeh ──
  tasbeehTitle: string;
  tasbeehCustom: string;
  tasbeehSession: string;
  tasbeehReset: string;
  tasbeehComplete: string;
  tasbeehDhikrEn: string;
  tasbeehDhikrAr: string;
  tasbeehTarget: string;
  tasbeehUse: string;

  // ── quran ──
  quranEyebrow: string;
  quranRead: string;
  quranSearch: string;
  quranContinueReading: string;
  quranResume: string;
  quranScript: string;
  quranScriptUthmani: string;
  quranScriptIndopak: string;
  quranReciter: string;
  quranAyat: string;
  quranMeccan: string;
  quranMedinan: string;
  quranCouldNotLoadSurah: string;

  // ── adhkar ──
  adhkarShowTranslit: string;
  adhkarHideTranslit: string;
  adhkarComplete: string;

  // ── bookmarks ──
  bookmarksEyebrow: string;
  bookmarksTitle: string;
  bookmarksEmpty: string;
  bookmarksCount: string;
  bookmarksRemoveTitle: string;
  bookmarksRemoveBody: string;

  // ── qibla ──
  qiblaEyebrow: string;
  qiblaTitle: string;
  qiblaWaiting: string;
  qiblaFromNorth: string;
  qiblaAlign: string;
  qiblaUnavailable: string;

  // ── sunnah ──
  sunnahEyebrow: string;
  sunnahDaily: string;
  sunnahLibrary: string;
  sunnahPeaceUpon: string;
  sunnahForTheHour: string;
  sunnahOfTheHour: string;
  sunnahTrigger: string;
  sunnahWhyOrdained: string;
  sunnahMarkRevived: string;
  sunnahRevivedToday: string;
  sunnahAllCategories: string;
  sunnahCommon: string;
  sunnahUncommon: string;
  sunnahForgotten: string;

  // ── duas ──
  duasEyebrow: string;
  duasTitle: string;
  duasSubtitle: string;

  // ── hadith ──
  hadithEyebrow: string;

  // ── settings ──
  settingsTitle: string;
  settingsProfile: string;
  settingsName: string;
  settingsAddressYou: string;
  settingsPrayerTimings: string;
  settingsAsrSchool: string;
  settingsStandard: string;
  settingsHanafi: string;
  settingsCalcMethod: string;
  settingsAuto: string;
  settingsAdhan: string;
  settingsSoundAdhan: string;
  settingsSoundAdhanSub: string;
  settingsMuezzin: string;
  settingsReading: string;
  settingsTextSize: string;
  settingsTextSizeSub: string;
  settingsLanguage: string;
  settingsLanguageSub: string;
  settingsRestartNote: string;
  settingsSaveChanges: string;
  settingsSignOut: string;
  settingsDeleteAccount: string;
  settingsSavedTitle: string;
  settingsSavedBody: string;

  // text sizes
  sizeRegular: string;
  sizeLarge: string;
  sizeXLarge: string;

  // a sample line used to preview the reading size
  sizePreviewLine: string;

  // ── reminders / notifications sheet ──
  remindersTitle: string;
  remindersUpcoming: string;
};
