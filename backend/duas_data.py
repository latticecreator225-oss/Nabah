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
    {
        "id": "guidance",
        "title": "Seeking Guidance",
        "subtitle": "الاستخارة",
        "monogram": "خ",
        "blurb": "When the way forward isn't clear — ask, then act.",
        "duas": [
            {
                "id": "istikharah",
                "arabic": "اللَّهُمَّ إِنِّي أَسْتَخِيرُكَ بِعِلْمِكَ، وَأَسْتَقْدِرُكَ بِقُدْرَتِكَ، وَأَسْأَلُكَ مِنْ فَضْلِكَ الْعَظِيمِ، فَإِنَّكَ تَقْدِرُ وَلَا أَقْدِرُ، وَتَعْلَمُ وَلَا أَعْلَمُ، وَأَنْتَ عَلَّامُ الْغُيُوبِ. اللَّهُمَّ إِنْ كُنْتَ تَعْلَمُ أَنَّ هَذَا الْأَمْرَ خَيْرٌ لِي فِي دِينِي وَمَعَاشِي وَعَاقِبَةِ أَمْرِي، فَاقْدُرْهُ لِي وَيَسِّرْهُ لِي، ثُمَّ بَارِكْ لِي فِيهِ، وَإِنْ كُنْتَ تَعْلَمُ أَنَّ هَذَا الْأَمْرَ شَرٌّ لِي فِي دِينِي وَمَعَاشِي وَعَاقِبَةِ أَمْرِي، فَاصْرِفْهُ عَنِّي وَاصْرِفْنِي عَنْهُ، وَاقْدُرْ لِيَ الْخَيْرَ حَيْثُ كَانَ، ثُمَّ أَرْضِنِي بِهِ",
                "transliteration": "Allāhumma innī astakhīruka bi‘ilmik, wa astaqdiruka biqudratik, wa as'aluka min faḍlika-l-‘aẓīm, fa innaka taqdiru wa lā aqdir, wa ta‘lamu wa lā a‘lam, wa anta ‘allāmu-l-ghuyūb. Allāhumma in kunta ta‘lamu anna hādha-l-amra khayrun lī fī dīnī wa ma‘āshī wa ‘āqibati amrī fa-qdurhu lī wa yassirhu lī thumma bārik lī fīh, wa in kunta ta‘lamu anna hādha-l-amra sharrun lī fī dīnī wa ma‘āshī wa ‘āqibati amrī fa-ṣrifhu ‘annī wa-ṣrifnī ‘anhu, wa-qdur liya-l-khayra ḥaythu kāna thumma arḍinī bih.",
                "translation": "O Allah, I seek Your guidance by Your knowledge, and I seek ability by Your power, and I ask You of Your great bounty. You are able while I am not, and You know while I do not, and You are the Knower of the unseen. O Allah, if You know that this matter (name it) is good for me in my religion, my livelihood, and the outcome of my affairs, then decree it for me, make it easy for me, and bless it for me. And if You know that this matter is bad for me in my religion, my livelihood, and the outcome of my affairs, then turn it away from me, and turn me away from it, and decree for me what is good wherever it may be, and make me content with it.",
                "occasion": "Before any matter you are undecided about — said after a two-rak'ah voluntary prayer, naming the matter in place of \"this matter\"",
                "reference": "Al-Bukhari",
            },
        ],
    },
    {
        "id": "illness_condolence",
        "title": "Illness & Loss",
        "subtitle": "المرض والمصيبة",
        "monogram": "م",
        "blurb": "At a sickbed, and in grief.",
        "duas": [
            {
                "id": "visiting_sick",
                "arabic": "لَا بَأْسَ طَهُورٌ إِنْ شَاءَ اللهُ",
                "transliteration": "Lā ba'sa, ṭahūrun in shā'a-llāh.",
                "translation": "No harm, it is a purification, if Allah wills.",
                "occasion": "When visiting someone who is ill",
                "reference": "Al-Bukhari",
            },
            {
                "id": "sick_person_dua",
                "arabic": "أَذْهِبِ الْبَأْسَ رَبَّ النَّاسِ، اشْفِ أَنْتَ الشَّافِي، لَا شِفَاءَ إِلَّا شِفَاؤُكَ، شِفَاءً لَا يُغَادِرُ سَقَمًا",
                "transliteration": "Adh-hibi-l-ba's, Rabba-n-nās, ishfi anta-sh-Shāfī, lā shifā'a illā shifā'uk, shifā'an lā yughādiru saqamā.",
                "translation": "Remove the harm, Lord of mankind, and heal, for You are the Healer. There is no healing except Your healing, a healing that leaves no illness.",
                "occasion": "For the sick, said over them",
                "reference": "Al-Bukhari & Muslim",
            },
            {
                "id": "musibah",
                "arabic": "إِنَّا لِلَّهِ وَإِنَّا إِلَيْهِ رَاجِعُونَ، اللَّهُمَّ أْجُرْنِي فِي مُصِيبَتِي وَأَخْلِفْ لِي خَيْرًا مِنْهَا",
                "transliteration": "Innā li-llāhi wa innā ilayhi rāji‘ūn. Allāhumma-jurnī fī muṣībatī wa akhlif lī khayran minhā.",
                "translation": "Indeed we belong to Allah, and indeed to Him we will return. O Allah, reward me for my affliction and compensate me with something better than it.",
                "occasion": "Upon news of a calamity or loss",
                "reference": "Muslim",
            },
            {
                "id": "condolence",
                "arabic": "إِنَّ لِلَّهِ مَا أَخَذَ، وَلَهُ مَا أَعْطَى، وَكُلُّ شَيْءٍ عِنْدَهُ بِأَجَلٍ مُسَمًّى، فَلْتَصْبِرْ وَلْتَحْتَسِبْ",
                "transliteration": "Inna li-llāhi mā akhadh, wa lahu mā a‘ṭā, wa kullu shay'in ‘indahu bi'ajalin musammā, fal-taṣbir wal-taḥtasib.",
                "translation": "To Allah belongs what He takes, and to Him belongs what He gives, and everything has an appointed time with Him. So be patient and seek reward.",
                "occasion": "When offering condolences to someone bereaved",
                "reference": "Al-Bukhari & Muslim",
            },
        ],
    },
    {
        "id": "social",
        "title": "Among People",
        "subtitle": "بين الناس",
        "monogram": "ن",
        "blurb": "Sneezing, anger, praise, and the ordinary moments between.",
        "duas": [
            {
                "id": "sneeze_self",
                "arabic": "الْحَمْدُ لِلَّهِ",
                "transliteration": "Al-ḥamdu li-llāh.",
                "translation": "All praise is for Allah.",
                "occasion": "After sneezing",
                "reference": "Al-Bukhari",
            },
            {
                "id": "sneeze_reply",
                "arabic": "يَرْحَمُكَ اللهُ",
                "transliteration": "Yarḥamuka-llāh.",
                "translation": "May Allah have mercy on you.",
                "occasion": "Said to someone who sneezed and praised Allah — they reply: Yahdīkumu-llāhu wa yuṣliḥu bālakum (\"May Allah guide you and rectify your condition\")",
                "reference": "Al-Bukhari",
            },
            {
                "id": "anger",
                "arabic": "أَعُوذُ بِاللهِ مِنَ الشَّيْطَانِ الرَّجِيمِ",
                "transliteration": "A‘ūdhu bi-llāhi mina-sh-shayṭāni-r-rajīm.",
                "translation": "I seek refuge in Allah from Satan, the accursed.",
                "occasion": "When angry",
                "reference": "Al-Bukhari & Muslim",
                "virtue": "The Prophet ﷺ said this would remove the anger a man felt.",
            },
            {
                "id": "amazement",
                "arabic": "مَا شَاءَ اللهُ لَا قُوَّةَ إِلَّا بِاللهِ",
                "transliteration": "Mā shā'a-llāh, lā quwwata illā bi-llāh.",
                "translation": "What Allah wills; there is no power except with Allah.",
                "occasion": "Upon seeing something that pleases or amazes you, in yourself or your wealth",
                "reference": "Al-Qur'an 18:39",
            },
            {
                "id": "praise_received",
                "arabic": "اللَّهُمَّ لَا تُؤَاخِذْنِي بِمَا يَقُولُونَ، وَاغْفِرْ لِي مَا لَا يَعْلَمُونَ، وَاجْعَلْنِي خَيْرًا مِمَّا يَظُنُّونَ",
                "transliteration": "Allāhumma lā tu'ākhidhnī bimā yaqūlūn, wa-ghfir lī mā lā ya‘lamūn, wa-j‘alnī khayran mimmā yaẓunnūn.",
                "translation": "O Allah, do not take me to task for what they say, forgive me for what they do not know, and make me better than what they think.",
                "occasion": "When someone praises you to your face",
                "reference": "Al-Bukhari (Al-Adab Al-Mufrad)",
            },
        ],
    },
    {
        "id": "weather",
        "title": "Weather & Signs",
        "subtitle": "الآيات الكونية",
        "monogram": "ر",
        "blurb": "Wind, thunder, and rain — reminders, not just weather.",
        "duas": [
            {
                "id": "wind",
                "arabic": "اللَّهُمَّ إِنِّي أَسْأَلُكَ خَيْرَهَا وَخَيْرَ مَا فِيهَا وَخَيْرَ مَا أُرْسِلَتْ بِهِ، وَأَعُوذُ بِكَ مِنْ شَرِّهَا وَشَرِّ مَا فِيهَا وَشَرِّ مَا أُرْسِلَتْ بِهِ",
                "transliteration": "Allāhumma innī as'aluka khayrahā wa khayra mā fīhā wa khayra mā ursilat bih, wa a‘ūdhu bika min sharrihā wa sharri mā fīhā wa sharri mā ursilat bih.",
                "translation": "O Allah, I ask You for its good, the good within it, and the good it was sent with, and I seek refuge in You from its evil, the evil within it, and the evil it was sent with.",
                "occasion": "When the wind blows",
                "reference": "Muslim",
            },
            {
                "id": "thunder",
                "arabic": "سُبْحَانَ الَّذِي يُسَبِّحُ الرَّعْدُ بِحَمْدِهِ وَالْمَلَائِكَةُ مِنْ خِيفَتِهِ",
                "transliteration": "Subḥāna-lladhī yusabbiḥu-r-ra‘du biḥamdihi wa-l-malā'ikatu min khīfatih.",
                "translation": "Glory be to Him whom the thunder glorifies with His praise, and the angels too, out of fear of Him.",
                "occasion": "Upon hearing thunder",
                "reference": "Al-Muwatta (Malik)",
            },
            {
                "id": "rain",
                "arabic": "اللَّهُمَّ صَيِّبًا نَافِعًا",
                "transliteration": "Allāhumma ṣayyiban nāfi‘ā.",
                "translation": "O Allah, (make it) a beneficial rain cloud.",
                "occasion": "When it starts to rain",
                "reference": "Al-Bukhari",
            },
            {
                "id": "new_moon",
                "arabic": "اللَّهُ أَكْبَرُ، اللَّهُمَّ أَهِلَّهُ عَلَيْنَا بِالْأَمْنِ وَالْإِيمَانِ، وَالسَّلَامَةِ وَالْإِسْلَامِ، وَالتَّوْفِيقِ لِمَا تُحِبُّ رَبَّنَا وَتَرْضَى، رَبُّنَا وَرَبُّكَ اللهُ",
                "transliteration": "Allāhu akbar. Allāhumma ahillahu ‘alaynā bi-l-amni wa-l-īmān, wa-s-salāmati wa-l-Islām, wa-t-tawfīqi limā tuḥibbu Rabbanā wa tarḍā, Rabbunā wa Rabbuka-llāh.",
                "translation": "Allah is the Greatest. O Allah, bring this moon over us with security and faith, safety and Islam, and success in that which our Lord loves and is pleased with. Our Lord and your Lord is Allah.",
                "occasion": "Upon sighting the new moon",
                "reference": "At-Tirmidhi",
            },
        ],
    },
    {
        "id": "marriage",
        "title": "Marriage",
        "subtitle": "الزواج",
        "monogram": "ز",
        "blurb": "Blessing a union, and beginning it well.",
        "duas": [
            {
                "id": "marriage_congrats",
                "arabic": "بَارَكَ اللهُ لَكَ وَبَارَكَ عَلَيْكَ، وَجَمَعَ بَيْنَكُمَا فِي خَيْرٍ",
                "transliteration": "Bāraka-llāhu laka, wa bāraka ‘alayk, wa jama‘a baynakumā fī khayr.",
                "translation": "May Allah bless you, and shower His blessings upon you, and join you together in goodness.",
                "occasion": "Congratulating someone who has just married",
                "reference": "Abu Dawud & At-Tirmidhi",
            },
            {
                "id": "marriage_night",
                "arabic": "اللَّهُمَّ إِنِّي أَسْأَلُكَ خَيْرَهَا وَخَيْرَ مَا جَبَلْتَهَا عَلَيْهِ، وَأَعُوذُ بِكَ مِنْ شَرِّهَا وَشَرِّ مَا جَبَلْتَهَا عَلَيْهِ",
                "transliteration": "Allāhumma innī as'aluka khayrahā wa khayra mā jabaltahā ‘alayh, wa a‘ūdhu bika min sharrihā wa sharri mā jabaltahā ‘alayh.",
                "translation": "O Allah, I ask You for the good in her and the good You have instilled in her nature, and I seek refuge in You from the evil in her and the evil You have instilled in her nature.",
                "occasion": "On the wedding night, holding the forehead of one's spouse",
                "reference": "Abu Dawud",
            },
        ],
    },
    {
        "id": "market_night",
        "title": "The Market & the Night",
        "subtitle": "السوق والليل",
        "monogram": "ل",
        "blurb": "Stepping into the crowd, and rising in the dark.",
        "duas": [
            {
                "id": "entering_market",
                "arabic": "لَا إِلَهَ إِلَّا اللهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ، يُحْيِي وَيُمِيتُ وَهُوَ حَيٌّ لَا يَمُوتُ، بِيَدِهِ الْخَيْرُ، وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ",
                "transliteration": "Lā ilāha illa-llāhu waḥdahu lā sharīka lah, lahu-l-mulku wa lahu-l-ḥamd, yuḥyī wa yumīt, wa huwa ḥayyun lā yamūt, biyadihi-l-khayr, wa huwa ‘alā kulli shay'in qadīr.",
                "translation": "There is none worthy of worship but Allah alone, with no partner. His is the dominion, and His is all praise. He gives life and causes death, and He is living and does not die. In His hand is all good, and He has power over all things.",
                "occasion": "Upon entering a marketplace",
                "reference": "At-Tirmidhi",
                "virtue": "A million good deeds are recorded for whoever says it, a million sins are erased, and he is raised a million ranks.",
            },
            {
                "id": "night_waking",
                "arabic": "لَا إِلَهَ إِلَّا اللهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ، سُبْحَانَ اللهِ، وَالْحَمْدُ لِلَّهِ، وَلَا إِلَهَ إِلَّا اللهُ، وَاللهُ أَكْبَرُ، وَلَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللهِ",
                "transliteration": "Lā ilāha illa-llāhu waḥdahu lā sharīka lah, lahu-l-mulku wa lahu-l-ḥamdu wa huwa ‘alā kulli shay'in qadīr. Subḥāna-llāh, wal-ḥamdu li-llāh, wa lā ilāha illa-llāh, wa-llāhu akbar, wa lā ḥawla wa lā quwwata illā bi-llāh.",
                "translation": "There is none worthy of worship but Allah alone, with no partner. His is the dominion and His is all praise, and He has power over all things. Glory be to Allah, praise be to Allah, there is none worthy of worship but Allah, Allah is the Greatest, and there is no might nor power except with Allah.",
                "occasion": "Upon waking in the night",
                "reference": "Al-Bukhari",
                "virtue": "If he then supplicates, it is answered; if he prays, it is accepted.",
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
