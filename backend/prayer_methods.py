"""
Nabah · Prayer Times

Region-aware calculation method picker + Aladhan proxy.
Different regions use different fiqh + astronomical conventions; using the
wrong method can shift Fajr/Isha by 5–20 minutes. We pick a sensible default
per latitude/longitude rectangle and let the user override.

Aladhan method IDs (https://aladhan.com/calculation-methods):
   1  Univ. of Islamic Sciences, Karachi
   2  Islamic Society of North America (ISNA)
   3  Muslim World League (MWL)
   4  Umm al-Qura, Makkah
   5  Egyptian General Authority of Survey
   7  Institute of Geophysics, University of Tehran
   8  Gulf Region
   9  Kuwait
  10  Qatar
  11  Majlis Ugama Islam Singapura (Singapore)
  12  Union des Organisations Islamiques de France
  13  Diyanet İşleri Başkanlığı (Turkey)
  14  Spiritual Administration of Muslims of Russia
  15  Moonsighting Committee Worldwide (MSCW)
  16  Dubai
  17  Jabatan Kemajuan Islam Malaysia (JAKIM)
  18  Tunisia
  19  Algeria
  20  Kementerian Agama Republik Indonesia
  21  Morocco
  22  Comunidade Islamica de Lisboa
  23  Ministry of Awqaf, Jordan
"""
from typing import Tuple


METHOD_NAMES = {
    1: "Karachi",
    2: "ISNA",
    3: "Muslim World League",
    4: "Umm al-Qura · Makkah",
    5: "Egyptian Authority",
    7: "Tehran",
    8: "Gulf Region",
    9: "Kuwait",
    10: "Qatar",
    11: "Singapore (MUIS)",
    12: "France (UOIF)",
    13: "Turkey (Diyanet)",
    14: "Russia",
    15: "Moonsighting Committee",
    16: "Dubai",
    17: "Malaysia (JAKIM)",
    18: "Tunisia",
    19: "Algeria",
    20: "Indonesia (Kemenag)",
    21: "Morocco",
    22: "Portugal · Lisboa",
    23: "Jordan",
}


def in_box(lat: float, lng: float, lat_lo: float, lat_hi: float, lng_lo: float, lng_hi: float) -> bool:
    return lat_lo <= lat <= lat_hi and lng_lo <= lng <= lng_hi


def pick_method(lat: float, lng: float) -> Tuple[int, str]:
    """Returns (method_id, friendly_name) for the given coordinates."""
    # Saudi Arabia → Umm al-Qura
    if in_box(lat, lng, 16, 32, 34, 56):
        return 4, METHOD_NAMES[4]
    # UAE
    if in_box(lat, lng, 22, 27, 51, 57):
        return 16, METHOD_NAMES[16]
    # Kuwait
    if in_box(lat, lng, 28, 31, 46, 49):
        return 9, METHOD_NAMES[9]
    # Qatar
    if in_box(lat, lng, 24, 27, 50, 52):
        return 10, METHOD_NAMES[10]
    # Egypt / Sudan / Libya — Egyptian Authority
    if in_box(lat, lng, 8, 34, 20, 38):
        return 5, METHOD_NAMES[5]
    # Tunisia
    if in_box(lat, lng, 30, 38, 7, 12):
        return 18, METHOD_NAMES[18]
    # Algeria
    if in_box(lat, lng, 18, 38, -9, 12):
        return 19, METHOD_NAMES[19]
    # Morocco
    if in_box(lat, lng, 21, 36, -17, -1):
        return 21, METHOD_NAMES[21]
    # Turkey
    if in_box(lat, lng, 35, 43, 25, 45):
        return 13, METHOD_NAMES[13]
    # Iran
    if in_box(lat, lng, 25, 40, 44, 64):
        return 7, METHOD_NAMES[7]
    # Pakistan / India / Bangladesh / Afghanistan — Karachi
    if in_box(lat, lng, 5, 38, 60, 93):
        return 1, METHOD_NAMES[1]
    # Indonesia / Malaysia / Singapore
    if in_box(lat, lng, -11, 8, 95, 142):
        if in_box(lat, lng, 0.8, 2, 103, 105):
            return 11, METHOD_NAMES[11]
        if in_box(lat, lng, -8, 8, 95, 120):
            return 17, METHOD_NAMES[17]
        return 20, METHOD_NAMES[20]
    # Jordan / Palestine / Israel / Lebanon / Syria — Jordan Awqaf
    if in_box(lat, lng, 29, 37, 33, 43):
        return 23, METHOD_NAMES[23]
    # Russia
    if in_box(lat, lng, 41, 82, 19, 180):
        return 14, METHOD_NAMES[14]
    # UK / Ireland — MWL (the most commonly used in the UK Muslim councils)
    if in_box(lat, lng, 49, 61, -11, 2):
        return 3, METHOD_NAMES[3]
    # France
    if in_box(lat, lng, 41, 51, 2, 9):
        return 12, METHOD_NAMES[12]
    # Portugal
    if in_box(lat, lng, 36, 43, -10, -6):
        return 22, METHOD_NAMES[22]
    # North America (US + Canada) — ISNA
    if in_box(lat, lng, 15, 75, -170, -50):
        return 2, METHOD_NAMES[2]
    # Default — Muslim World League (best globally accepted)
    return 3, METHOD_NAMES[3]
