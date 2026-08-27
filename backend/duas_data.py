"""
Nabah · Duas (Fortress of the Muslim style)

A curated set of authentic, situational supplications — distinct from the three
daily Adhkar windows (morning/evening/sleep) handled elsewhere. Each dua carries
its Arabic, a readable transliteration, an English meaning, and a source so the
content can be trusted and verified.

Shape per category:  { id, title, subtitle, monogram, duas: [Dua] }
Shape per dua:        { id, arabic, transliteration, translation, reference, virtue?, count? }
"""
from typing import Dict, List, Optional

DUA_CATEGORIES: List[Dict] = [
    {
        "id": "distress",
        "title": "In Hardship",
        "subtitle": "كرب",
        "monogram": "ك",
        "blurb": "When the chest tightens — words the Prophet ﷺ turned to.",
        "duas": [
            {
                "id": "distress_kareeb",
                "arabic": "لَا إِلَهَ إِلَّا اللهُ الْعَظِيمُ الْحَلِيمُ، لَا إِلَهَ إِلَّا اللهُ رَبُّ الْعَرْشِ الْعَظِيمِ، لَا إِلَهَ إِلَّا اللهُ رَبُّ السَّمَاوَاتِ وَرَبُّ الْأَرْضِ وَرَبُّ الْعَرْشِ الْكَرِيمِ",
                "transliteration": "Lā ilāha illā-llāhu al-‘Aẓīmu al-Ḥalīm, lā ilāha illā-llāhu Rabbu al-‘Arshi al-‘Aẓīm, lā ilāha illā-llāhu Rabbu as-samāwāti wa Rabbu al-arḍi wa Rabbu al-‘Arshi al-Karīm.",
                "translation": "There is none worthy of worship but Allah, the Mighty, the Forbearing. There is none worthy of worship but Allah, Lord of the Magnificent Throne. There is none worthy of worship but Allah, Lord of the heavens, Lord of the earth, and Lord of the Noble Throne.",
                "occasion": "In times of distress",
                "reference": "Al-Bukhari & Muslim",
                "virtue": "The Prophet ﷺ would say this in times of distress.",
            },
            {
                "id": "distress_hamm",
                "arabic": "اللَّهُمَّ إِنِّي أَعُوذُ بِكَ مِنَ الْهَمِّ وَالْحَزَنِ، وَالْعَجْزِ وَالْكَسَلِ، وَالْبُخْلِ وَالْجُبْنِ، وَضَلَعِ الدَّيْنِ وَغَلَبَةِ الرِّجَالِ",
                "transliteration": "Allāhumma innī a‘ūdhu bika mina al-hammi wa-l-ḥazan, wa-l-‘ajzi wa-l-kasal, wa-l-bukhli wa-l-jubn, wa ḍala‘i-d-dayni wa ghalabati-r-rijāl.",
                "translation": "O Allah, I seek refuge in You from anxiety and grief, from weakness and laziness, from miserliness and cowardice, from the burden of debt and from being overpowered by men.",
                "occasion": "When anxious, grieving, or overwhelmed",
                "reference": "Al-Bukhari",
            },
            {
                "id": "distress_hasbunallah",
                "arabic": "حَسْبُنَا اللهُ وَنِعْمَ الْوَكِيلُ",
                "transliteration": "Ḥasbunā-llāhu wa ni‘ma al-wakīl.",
                "translation": "Allah is sufficient for us, and He is the best Disposer of affairs.",
                "occasion": "When afraid or overwhelmed",
                "reference": "Qur'an 3:173",
            },
            {
                "id": "distress_yunus",
                "arabic": "لَا إِلَهَ إِلَّا أَنْتَ سُبْحَانَكَ إِنِّي كُنْتُ مِنَ الظَّالِمِينَ",
                "transliteration": "Lā ilāha illā anta subḥānaka innī kuntu mina aẓ-ẓālimīn.",
                "translation": "There is none worthy of worship but You. Glory be to You — indeed, I have been among the wrongdoers.",
                "occasion": "In hardship — the supplication of Yunus ﷺ",
                "reference": "Qur'an 21:87",
                "virtue": "No Muslim supplicates with it for anything but Allah answers him.",
            },
        ],
    },
    {
        "id": "forgiveness",
        "title": "Seeking Forgiveness",
        "subtitle": "استغفار",
        "monogram": "غ",
        "blurb": "Return to Him — the door is never closed.",
        "duas": [
            {
                "id": "forgiveness_sayyid",
                "arabic": "اللَّهُمَّ أَنْتَ رَبِّي لَا إِلَهَ إِلَّا أَنْتَ، خَلَقْتَنِي وَأَنَا عَبْدُكَ، وَأَنَا عَلَى عَهْدِكَ وَوَعْدِكَ مَا اسْتَطَعْتُ، أَعُوذُ بِكَ مِنْ شَرِّ مَا صَنَعْتُ، أَبُوءُ لَكَ بِنِعْمَتِكَ عَلَيَّ، وَأَبُوءُ بِذَنْبِي فَاغْفِرْ لِي فَإِنَّهُ لَا يَغْفِرُ الذُّنُوبَ إِلَّا أَنْتَ",
                "transliteration": "Allāhumma anta Rabbī lā ilāha illā anta, khalaqtanī wa anā ‘abduk, wa anā ‘alā ‘ahdika wa wa‘dika ma-staṭa‘t, a‘ūdhu bika min sharri mā ṣana‘t, abū'u laka bini‘matika ‘alayy, wa abū'u bidhanbī faghfir lī fa-innahu lā yaghfiru-dh-dhunūba illā ant.",
                "translation": "O Allah, You are my Lord, there is none worthy of worship but You. You created me and I am Your servant. I keep Your covenant as much as I can. I seek refuge in You from the evil of what I have done. I acknowledge Your favour upon me, and I acknowledge my sin — so forgive me, for none forgives sins but You.",
                "occasion": "Morning and evening — the master of seeking forgiveness",
                "reference": "Al-Bukhari",
                "virtue": "Whoever says it by day with certainty and dies that day enters Paradise.",
            },
            {
                "id": "forgiveness_tawwab",
                "arabic": "رَبِّ اغْفِرْ لِي وَتُبْ عَلَيَّ إِنَّكَ أَنْتَ التَّوَّابُ الرَّحِيمُ",
                "transliteration": "Rabbi-ghfir lī wa tub ‘alayya innaka anta-t-Tawwābu-r-Raḥīm.",
                "translation": "My Lord, forgive me and accept my repentance; indeed You are the Ever-Relenting, the Most Merciful.",
                "occasion": "Any time, seeking repentance",
                "reference": "Abu Dawud & At-Tirmidhi",
                "count": 100,
            },
            {
                "id": "forgiveness_astaghfir",
                "arabic": "أَسْتَغْفِرُ اللهَ الَّذِي لَا إِلَهَ إِلَّا هُوَ الْحَيَّ الْقَيُّومَ وَأَتُوبُ إِلَيْهِ",
                "transliteration": "Astaghfiru-llāha-lladhī lā ilāha illā huwa al-Ḥayya al-Qayyūma wa atūbu ilayh.",
                "translation": "I seek the forgiveness of Allah, besides whom there is no deity, the Ever-Living, the Sustainer, and I turn to Him in repentance.",
                "occasion": "Frequently, throughout the day",
                "reference": "Abu Dawud & At-Tirmidhi",
                "virtue": "Said sincerely, the sins are forgiven even if one fled from battle.",
            },
        ],
    },
    {
        "id": "home_travel",
        "title": "Home & Travel",
        "subtitle": "السفر",
        "monogram": "ب",
        "blurb": "At the threshold, and upon the road.",
        "duas": [
            {
                "id": "leaving_home",
                "arabic": "بِسْمِ اللهِ، تَوَكَّلْتُ عَلَى اللهِ، وَلَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللهِ",
                "transliteration": "Bismi-llāh, tawakkaltu ‘alā-llāh, wa lā ḥawla wa lā quwwata illā bi-llāh.",
                "translation": "In the name of Allah, I place my trust in Allah, and there is no might nor power except with Allah.",
                "occasion": "Upon leaving home",
                "reference": "Abu Dawud & At-Tirmidhi",
                "virtue": "It is said: you are guided, defended, and protected.",
            },
            {
                "id": "entering_home",
                "arabic": "بِسْمِ اللهِ وَلَجْنَا، وَبِسْمِ اللهِ خَرَجْنَا، وَعَلَى اللهِ رَبِّنَا تَوَكَّلْنَا",
                "transliteration": "Bismi-llāhi walajnā, wa bismi-llāhi kharajnā, wa ‘alā-llāhi Rabbinā tawakkalnā.",
                "translation": "In the name of Allah we enter, in the name of Allah we leave, and upon Allah our Lord we place our trust.",
                "occasion": "Upon entering home",
                "reference": "Abu Dawud",
            },
            {
                "id": "travel_mount",
                "arabic": "سُبْحَانَ الَّذِي سَخَّرَ لَنَا هَذَا وَمَا كُنَّا لَهُ مُقْرِنِينَ، وَإِنَّا إِلَى رَبِّنَا لَمُنْقَلِبُونَ",
                "transliteration": "Subḥāna-lladhī sakhkhara lanā hādhā wa mā kunnā lahu muqrinīn, wa innā ilā Rabbinā la-munqalibūn.",
                "translation": "Glory to Him who has subjected this to us, and we could never have done it by ourselves. And indeed, to our Lord we will return.",
                "occasion": "When setting out on a journey",
                "reference": "Muslim (Qur'an 43:13-14)",
            },
        ],
    },
    {
        "id": "food",
        "title": "At the Table",
        "subtitle": "الطعام",
        "monogram": "ط",
        "blurb": "Begin in His name; end in His praise.",
        "duas": [
            {
                "id": "food_before",
                "arabic": "بِسْمِ اللهِ",
                "transliteration": "Bismi-llāh.",
                "translation": "In the name of Allah. (If you forget at the start: «Bismi-llāhi awwalahu wa ākhirah» — In the name of Allah, at its beginning and its end.)",
                "occasion": "Before eating",
                "reference": "Abu Dawud & At-Tirmidhi",
            },
            {
                "id": "food_after",
                "arabic": "الْحَمْدُ لِلَّهِ الَّذِي أَطْعَمَنِي هَذَا وَرَزَقَنِيهِ مِنْ غَيْرِ حَوْلٍ مِنِّي وَلَا قُوَّةٍ",
                "transliteration": "Al-ḥamdu li-llāhi-lladhī aṭ‘amanī hādhā wa razaqanīhi min ghayri ḥawlin minnī wa lā quwwah.",
                "translation": "All praise is for Allah who fed me this and provided it for me, with no might nor power on my part.",
                "occasion": "After eating",
                "reference": "Abu Dawud & At-Tirmidhi",
                "virtue": "His past sins are forgiven.",
            },
        ],
    },
    {
        "id": "protection",
        "title": "Refuge & Protection",
        "subtitle": "الحفظ",
        "monogram": "ح",
        "blurb": "A fortress of words against every harm.",
        "duas": [
            {
                "id": "protection_kalimat",
                "arabic": "أَعُوذُ بِكَلِمَاتِ اللهِ التَّامَّاتِ مِنْ شَرِّ مَا خَلَقَ",
                "transliteration": "A‘ūdhu bikalimāti-llāhi-t-tāmmāti min sharri mā khalaq.",
                "translation": "I seek refuge in the perfect words of Allah from the evil of what He has created.",
                "occasion": "Upon settling in a new place",
                "reference": "Muslim",
                "count": 3,
            },
            {
                "id": "protection_bismillah",
                "arabic": "بِسْمِ اللهِ الَّذِي لَا يَضُرُّ مَعَ اسْمِهِ شَيْءٌ فِي الْأَرْضِ وَلَا فِي السَّمَاءِ، وَهُوَ السَّمِيعُ الْعَلِيمُ",
                "transliteration": "Bismi-llāhi-lladhī lā yaḍurru ma‘a-smihi shay'un fi-l-arḍi wa lā fi-s-samā', wa huwa-s-Samī‘u-l-‘Alīm.",
                "translation": "In the name of Allah, with whose name nothing in the earth or the heavens can cause harm, and He is the All-Hearing, the All-Knowing.",
                "occasion": "Morning and evening, three times",
                "reference": "Abu Dawud & At-Tirmidhi",
                "count": 3,
                "virtue": "Said thrice morning and evening, no sudden affliction will harm.",
            },
        ],
    },
    {
        "id": "dailylife",
        "title": "Through the Day",
        "subtitle": "اليوم",
        "monogram": "ي",
        "blurb": "The small turnings — waking, dressing, resting.",
        "duas": [
            {
                "id": "daily_waking",
                "arabic": "الْحَمْدُ لِلَّهِ الَّذِي أَحْيَانَا بَعْدَ مَا أَمَاتَنَا وَإِلَيْهِ النُّشُورُ",
                "transliteration": "Al-ḥamdu li-llāhi-lladhī aḥyānā ba‘da mā amātanā wa ilayhi-n-nushūr.",
                "translation": "All praise is for Allah who gave us life after He caused us to die, and to Him is the resurrection.",
                "occasion": "Upon waking",
                "reference": "Al-Bukhari",
            },
            {
                "id": "daily_sleep",
                "arabic": "بِاسْمِكَ اللَّهُمَّ أَمُوتُ وَأَحْيَا",
                "transliteration": "Bismika-llāhumma amūtu wa aḥyā.",
                "translation": "In Your name, O Allah, I die and I live.",
                "occasion": "Before sleeping",
                "reference": "Al-Bukhari",
            },
            {
                "id": "daily_garment",
                "arabic": "الْحَمْدُ لِلَّهِ الَّذِي كَسَانِي هَذَا الثَّوْبَ وَرَزَقَنِيهِ مِنْ غَيْرِ حَوْلٍ مِنِّي وَلَا قُوَّةٍ",
                "transliteration": "Al-ḥamdu li-llāhi-lladhī kasānī hādhā ath-thawba wa razaqanīhi min ghayri ḥawlin minnī wa lā quwwah.",
                "translation": "All praise is for Allah who has clothed me with this garment and provided it for me, with no might nor power on my part.",
                "occasion": "When putting on new clothing",
                "reference": "Abu Dawud & At-Tirmidhi",
            },
            {
                "id": "daily_restroom",
                "arabic": "اللَّهُمَّ إِنِّي أَعُوذُ بِكَ مِنَ الْخُبُثِ وَالْخَبَائِثِ",
                "transliteration": "Allāhumma innī a‘ūdhu bika mina al-khubuthi wa-l-khabā'ith.",
                "translation": "O Allah, I seek refuge in You from male and female evil (devils).",
                "occasion": "Before entering the restroom",
                "reference": "Al-Bukhari & Muslim",
            },
        ],
    },
    {
        "id": "salah",
        "title": "Around Prayer",
        "subtitle": "الصلاة",
        "monogram": "ص",
        "blurb": "Wudu, the masjid, the moments between.",
        "duas": [
            {
                "id": "salah_after_wudu",
                "arabic": "أَشْهَدُ أَنْ لَا إِلَهَ إِلَّا اللهُ وَحْدَهُ لَا شَرِيكَ لَهُ، وَأَشْهَدُ أَنَّ مُحَمَّدًا عَبْدُهُ وَرَسُولُهُ",
                "transliteration": "Ashhadu an lā ilāha illā-llāhu waḥdahu lā sharīka lah, wa ashhadu anna Muḥammadan ‘abduhu wa rasūluh.",
                "translation": "I bear witness that there is none worthy of worship but Allah alone, with no partner, and I bear witness that Muhammad is His servant and Messenger.",
                "occasion": "After completing wudu",
                "reference": "Muslim",
                "virtue": "The eight gates of Paradise are opened for him to enter by whichever he wishes.",
            },
            {
                "id": "salah_enter_masjid",
                "arabic": "اللَّهُمَّ افْتَحْ لِي أَبْوَابَ رَحْمَتِكَ",
                "transliteration": "Allāhumma-ftaḥ lī abwāba raḥmatik.",
                "translation": "O Allah, open for me the gates of Your mercy.",
                "occasion": "When entering the masjid",
                "reference": "Muslim",
            },
            {
                "id": "salah_leave_masjid",
                "arabic": "اللَّهُمَّ إِنِّي أَسْأَلُكَ مِنْ فَضْلِكَ",
                "transliteration": "Allāhumma innī as'aluka min faḍlik.",
                "translation": "O Allah, I ask You from Your bounty.",
                "occasion": "When leaving the masjid",
                "reference": "Muslim",
            },
        ],
    },
]


def categories_summary() -> List[dict]:
    """Lightweight list for the category grid (no dua bodies)."""
    return [
        {
            "id": c["id"],
            "title": c["title"],
            "subtitle": c["subtitle"],
            "monogram": c["monogram"],
            "blurb": c["blurb"],
            "count": len(c["duas"]),
        }
        for c in DUA_CATEGORIES
    ]


def category_by_id(cat_id: str) -> Optional[dict]:
    for c in DUA_CATEGORIES:
        if c["id"] == cat_id:
            return c
    return None
