type CityEntry = { adj: string; joke: string }

const CITY_MAP: Record<string, CityEntry> = {
  adana:           { adj: "Adanalı",        joke: "Acı biberi ve Adana kebabını bize de getirsin 🌶️" },
  kahramanmaras:   { adj: "Kahramanmaraşlı",joke: "Umarız maraş dondurmasını da getirir 🍦" },
  maras:           { adj: "Kahramanmaraşlı",joke: "Umarız maraş dondurmasını da getirir 🍦" },
  sivas:           { adj: "Sivaslı",         joke: "Kangal köpeklerinden selam getirdi 🐕" },
  ankara:          { adj: "Ankaralı",        joke: "Başkent'ten ilk adımını attı 🏛️" },
  istanbul:        { adj: "İstanbullu",      joke: "Boğaz trafiğinden kurtulup geldi 🌉" },
  izmir:           { adj: "İzmirli",         joke: "Ege'nin serinliğini getirdi 🌊" },
  bursa:           { adj: "Bursalı",         joke: "İskender bırakmadan aramıza katıldı 🥩" },
  konya:           { adj: "Konyalı",         joke: "Sema dönerken uğradı 🌀" },
  trabzon:         { adj: "Trabzonlu",       joke: "Çayını bitirip doğruca geldi ☕" },
  erzurum:         { adj: "Erzurumlu",       joke: "Erzurum soğuğundan kaçıp geldi 🥶" },
  gaziantep:       { adj: "Antepli",         joke: "Baklavasını yanına alıp geldi 🍮" },
  antep:           { adj: "Antepli",         joke: "Baklavasını yanına alıp geldi 🍮" },
  diyarbakir:      { adj: "Diyarbakırlı",   joke: "Karpuzunu bırakıp aramıza katıldı 🍉" },
  corum:           { adj: "Çorumlu",         joke: "Leblebisini cebine koyup geldi 🫘" },
  kayseri:         { adj: "Kayserili",       joke: "Pastırması ve zekâsıyla geldi 🧠" },
  van:             { adj: "Vanlı",           joke: "Van kedisi gibi sessizce aramıza katıldı 🐱" },
  hatay:           { adj: "Hataylı",         joke: "Hatay sofrasının bereketini getirdi 🫒" },
  mersin:          { adj: "Mersinli",        joke: "Akdeniz'den dalga dalga geldi 🏖️" },
  antalya:         { adj: "Antalyalı",       joke: "Tatili bitmeden aramıza katıldı ☀️" },
  rize:            { adj: "Rizeli",          joke: "Çay bahçesini bırakıp geldi 🌿" },
  ordu:            { adj: "Ordulu",          joke: "Fındıklarını toplayıp geldi 🌰" },
  malatya:         { adj: "Malatyalı",       joke: "Kayısılarını kurutup geldi 🍑" },
  urfa:            { adj: "Urfalı",          joke: "Çiğ köfteyi yapıp geldi 🍢" },
  sanliurfa:       { adj: "Urfalı",          joke: "Çiğ köfteyi yapıp geldi 🍢" },
  elazig:          { adj: "Elazığlı",        joke: "Elazığ'ın sıcaklığını getirdi ☀️" },
  erzincan:        { adj: "Erzincanlı",      joke: "Tulum peynirini bırakmadan geldi 🧀" },
  kars:            { adj: "Karslı",          joke: "Kars'ın meşhur kaşarıyla geldi 🧀" },
  nevsehir:        { adj: "Nevşehirli",      joke: "Kapadokya'dan balonla uçarak geldi 🎈" },
  isparta:         { adj: "Ispartalı",       joke: "Gül bahçesinden koşup geldi 🌹" },
  denizli:         { adj: "Denizlili",       joke: "Pamukkale'den atlayıp geldi 💧" },
  mugla:           { adj: "Muğlalı",         joke: "Bodrum'dan tatilden dönüp uğradı ⛵" },
  sakarya:         { adj: "Sakaryalı",       joke: "Sakarya Nehri gibi akıp geldi 🌊" },
  zonguldak:       { adj: "Zonguldaklı",     joke: "Maden ocağından çıkıp doğruca geldi ⛏️" },
  kastamonu:       { adj: "Kastamonulu",     joke: "Sucuğunu yanına alıp geldi 🌭" },
  afyon:           { adj: "Afyonlu",         joke: "Kaymağını ve sucuğunu getirdi 🥛" },
  tokat:           { adj: "Tokatlı",         joke: "Tokat kebabını paylaşmak için geldi 🔥" },
  amasya:          { adj: "Amasyalı",        joke: "Amasya elmasından bir sepet getirdi 🍎" },
  sinop:           { adj: "Sinoplu",         joke: "Karadeniz'in en kuzeyinden indi 🧭" },
  batman:          { adj: "Batmanlı",        joke: "Batman'dan geldi 🦇 (Türkiye'deki)" },
  siirt:           { adj: "Siirtli",         joke: "Siirt büryanını bırakmadan geldi 🍖" },
  bolu:            { adj: "Bolulu",          joke: "Dağ havasından bir nefes alıp geldi 🌬️" },
  edirne:          { adj: "Edirneli",        joke: "Kırkpınar'dan pehlivan gibi geldi 💪" },
  tekirdağ:        { adj: "Tekirdağlı",      joke: "Köftesini tabağa koyup geldi 🍖" },
  tekirdag:        { adj: "Tekirdağlı",      joke: "Köftesini tabağa koyup geldi 🍖" },
  canakkale:       { adj: "Çanakkaleli",     joke: "Boğaz'dan geçip aramıza katıldı ⚓" },
  giresun:         { adj: "Giresunlu",       joke: "Fındığını toplayıp geldi 🌰" },
  bingol:          { adj: "Bingöllü",        joke: "Bingöl'ün doğasından ilham alarak geldi 🌲" },
  agri:            { adj: "Ağrılı",          joke: "Ağrı Dağı'nın gölgesinden indi 🏔️" },
  kocaeli:         { adj: "Kocaelili",       joke: "İzmit Körfezi'nden selamlayarak geldi 🌊" },
  izmit:           { adj: "Kocaelili",       joke: "İzmit'ten bize merhaba dedi 🌊" },
  balikesir:       { adj: "Balıkesirli",     joke: "Zeytinyağını getirip geldi 🫒" },
  manisa:          { adj: "Manisalı",        joke: "Mesir Macunu'nun enerjisiyle geldi 💊" },
  aydin:           { adj: "Aydınlı",         joke: "Aydın inciri kadar tatlı biri geldi 🍈" },
  aksaray:         { adj: "Aksaraylı",       joke: "Ihlara Vadisi'nden yürüyerek geldi 🏔️" },
  nigde:           { adj: "Niğdeli",         joke: "Niğde elmasından bir ısırık alıp geldi 🍎" },
  karaman:         { adj: "Karamanlı",       joke: "Tarihî sokaklardan geçip geldi 🏛️" },
  yozgat:          { adj: "Yozgatlı",        joke: "Yaylanın serinliğinden selam getirdi 🌿" },
  kirsehir:        { adj: "Kırşehirli",      joke: "Bağlamasını çalarak aramıza katıldı 🎸" },
  bartin:          { adj: "Bartınlı",        joke: "Bartın'ın ormanlarından selam getirdi 🌲" },
  karabuk:         { adj: "Karabüklü",       joke: "Safranbolu şerbetiyle geldi 🍯" },
  duzce:           { adj: "Düzceli",         joke: "Fındık bahçelerinden selam getirdi 🌰" },
  kilis:           { adj: "Kilisli",         joke: "Zeytinyağlı lezzetlerle geldi 🫒" },
  ardahan:         { adj: "Ardahanlı",       joke: "Ardahan soğuğundan kaçıp sıcak selamla geldi ❄️" },
  igdir:           { adj: "Iğdırlı",         joke: "Iğdır kavunundan bir dilim getirdi 🍈" },
  artvin:          { adj: "Artvinli",        joke: "Artvin'in yeşilliğinden selam getirdi 🌿" },
  gumusane:        { adj: "Gümüşhaneli",     joke: "Gümüşhane pestilini yanına aldı 🍇" },
  bayburt:         { adj: "Bayburtlu",       joke: "Bayburt'un yaylasından geldi 💨" },
  mus:             { adj: "Muşlu",           joke: "Muş ovasından koşarak geldi 🏃" },
  bitlis:          { adj: "Bitlisli",        joke: "Tarihi kalelerden selam getirdi 🏰" },
  tunceli:         { adj: "Tuncelili",       joke: "Munzur'un sularından selam getirdi 🏔️" },
  hakkari:         { adj: "Hakkarili",       joke: "Hakkari zirvelerinden indi 🏔️" },
}

function normalize(s: string) {
  return s
    .toLowerCase()
    .replace(/ğ/g, "g").replace(/ı/g, "i").replace(/ş/g, "s")
    .replace(/ç/g, "c").replace(/ö/g, "o").replace(/ü/g, "u")
    .replace(/â/g, "a").replace(/î/g, "i").replace(/û/g, "u")
    .trim()
}

export function buildWelcomePost(name: string, memleket: string | null, station: string) {
  const m = normalize(memleket ?? "")

  let entry: CityEntry | undefined
  for (const [key, val] of Object.entries(CITY_MAP)) {
    if (m.includes(key) || key.includes(m.replace(/\s+/g, ""))) {
      entry = val
      break
    }
  }

  const content = entry
    ? `${entry.adj} ${name} Youth Station Uygulamasına giriş yaptı ! ${entry.joke} 👋`
    : `${name} Youth Station Uygulamasına katıldı ! Aramıza hoş geldin ! 🎉👋`

  return {
    author: "YSA Uygulaması",
    initials: "YSA",
    station,
    content,
  }
}
