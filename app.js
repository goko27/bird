/* ==========================================================================
   Bird Watching Electronic Log (BirdLogApp) - Frontend Application Logic (app.js)
   Handles Observation Recording, Photo Encoding, Weather Tracking,
   Search & Filter, Record Management (CRUD), and Statistics.
   ========================================================================== */

const BACKEND_ORIGIN = String(window.BIRDLOG_BACKEND_URL || '').replace(/\/$/, '');
const API_BASE = BACKEND_ORIGIN ? `${BACKEND_ORIGIN}/api` : (window.location.protocol.startsWith('http') ? '/api' : 'http://localhost:5000/api');

// No default/demo observations or default images.
const FALLBACK_OBSERVATIONS = [];

const BIRD_SPECIES_TYPES = [
  'Passerine', 'Raptor', 'Waterfowl', 'Shorebird', 'Seabird', 'Wading Bird',
  'Woodpecker', 'Hummingbird', 'Owl', 'Gamebird', 'Parrot', 'Pigeon & Dove',
  'Kingfisher', 'Flamingo', 'Cuckoo', 'Hornbill', 'Bee-eater', 'Roller',
  'Sunbird', 'Other'
];

const BIRD_TYPE_MAP = {
  // Common short names + species names. These are checked first so typing
  // a simple name such as "crow" immediately fills Species / type.
  'crow':'Passerine','sparrow':'Passerine','myna':'Passerine','bulbul':'Passerine',
  'robin':'Passerine','tailorbird':'Passerine','babbler':'Passerine','eagle':'Raptor',
  'hawk':'Raptor','kite':'Raptor','falcon':'Raptor','vulture':'Raptor','owl':'Owl',
  'duck':'Waterfowl','goose':'Waterfowl','swan':'Waterfowl','parrot':'Parrot',
  'parakeet':'Parrot','pigeon':'Pigeon & Dove','dove':'Pigeon & Dove',
  'kingfisher':'Kingfisher','woodpecker':'Woodpecker','hummingbird':'Hummingbird',
  'flamingo':'Flamingo','cuckoo':'Cuckoo','koel':'Cuckoo','coucal':'Cuckoo',
  'hornbill':'Hornbill','bee-eater':'Bee-eater','bee eater':'Bee-eater','roller':'Roller',
  'sunbird':'Sunbird','heron':'Wading Bird','egret':'Wading Bird','stork':'Wading Bird',
  'ibis':'Wading Bird','crane':'Wading Bird','gull':'Seabird','tern':'Seabird',
  'cormorant':'Seabird','pelican':'Seabird','peacock':'Gamebird','peafowl':'Gamebird',
  'pheasant':'Gamebird','quail':'Gamebird','partridge':'Gamebird',
  'house crow':'Passerine','common myna':'Passerine','indian peafowl':'Gamebird',
  'rose-ringed parakeet':'Parrot','house sparrow':'Passerine','red-vented bulbul':'Passerine',
  'white-throated kingfisher':'Kingfisher','cattle egret':'Wading Bird','little egret':'Wading Bird',
  'indian pond heron':'Wading Bird','greater flamingo':'Flamingo','black kite':'Raptor',
  'brahminy kite':'Raptor','crested serpent eagle':'Raptor','indian roller':'Roller',
  'asian koel':'Cuckoo','greater coucal':'Cuckoo','common kingfisher':'Kingfisher',
  'oriental magpie-robin':'Passerine','purple sunbird':'Sunbird','common tailorbird':'Passerine',
  'jungle babbler':'Passerine','indian robin':'Passerine','spotted dove':'Pigeon & Dove',
  'eurasian collared dove':'Pigeon & Dove','rock pigeon':'Pigeon & Dove','asian openbill':'Wading Bird',
  'painted stork':'Wading Bird','black-headed ibis':'Wading Bird','little cormorant':'Seabird',
  'spot-billed duck':'Waterfowl','lesser whistling duck':'Waterfowl'
};

const FALLBACK_SPECIES = [
  { id: 'sp1', name: 'House Crow', category: 'Crow / Corvid' },
  { id: 'sp2', name: 'Common Myna', category: 'Myna / Starling' },
  { id: 'sp3', name: 'Indian Peafowl', category: 'Peafowl' },
  { id: 'sp4', name: 'Rose-ringed Parakeet', category: 'Parrot' },
  { id: 'sp5', name: 'House Sparrow', category: 'Sparrow' },
  { id: 'sp6', name: 'Red-vented Bulbul', category: 'Bulbul' },
  { id: 'sp7', name: 'White-throated Kingfisher', category: 'Kingfisher' },
  { id: 'sp8', name: 'Cattle Egret', category: 'Egret' },
  { id: 'sp9', name: 'Little Egret', category: 'Egret' },
  { id: 'sp10', name: 'Indian Pond Heron', category: 'Heron' },
  { id: 'sp11', name: 'Greater Flamingo', category: 'Flamingo' },
  { id: 'sp12', name: 'Black Kite', category: 'Raptor' },
  { id: 'sp13', name: 'Brahminy Kite', category: 'Raptor' },
  { id: 'sp14', name: 'Crested Serpent Eagle', category: 'Raptor' },
  { id: 'sp15', name: 'Indian Roller', category: 'Roller' },
  { id: 'sp16', name: 'Asian Koel', category: 'Cuckoo' },
  { id: 'sp17', name: 'Greater Coucal', category: 'Cuckoo' },
  { id: 'sp18', name: 'Common Kingfisher', category: 'Kingfisher' },
  { id: 'sp19', name: 'Oriental Magpie-Robin', category: 'Flycatcher' },
  { id: 'sp20', name: 'Purple Sunbird', category: 'Sunbird' },
  { id: 'sp21', name: 'Common Tailorbird', category: 'Warbler' },
  { id: 'sp22', name: 'Jungle Babbler', category: 'Babbler' },
  { id: 'sp23', name: 'Indian Robin', category: 'Robin' },
  { id: 'sp24', name: 'Spotted Dove', category: 'Dove' },
  { id: 'sp25', name: 'Eurasian Collared Dove', category: 'Dove' },
  { id: 'sp26', name: 'Rock Pigeon', category: 'Pigeon' },
  { id: 'sp27', name: 'Asian Openbill', category: 'Stork' },
  { id: 'sp28', name: 'Painted Stork', category: 'Stork' },
  { id: 'sp29', name: 'Black-headed Ibis', category: 'Ibis' },
  { id: 'sp30', name: 'Little Cormorant', category: 'Cormorant' },
  { id: 'sp31', name: 'Spot-billed Duck', category: 'Duck' },
  { id: 'sp32', name: 'Lesser Whistling Duck', category: 'Duck' },
  { id: 'sp33', name: 'Common Hoopoe', category: 'Hoopoe' },
  { id: 'sp34', name: 'Coppersmith Barbet', category: 'Barbet' },
  { id: 'sp35', name: 'Black-rumped Flameback', category: 'Woodpecker' },
  { id: 'sp36', name: 'Asian Palm Swift', category: 'Swift' },
  { id: 'sp37', name: 'Barn Owl', category: 'Owl' },
  { id: 'sp38', name: 'Spotted Owlet', category: 'Owl' },
  { id: 'sp39', name: 'Grey Francolin', category: 'Gamebird' }
];

// India state/UT -> district lookup used by BirdLog's observation form.
// Administrative lists can change over time; this is a broad static reference
// intended for the project's dependent State -> District dropdown.
const INDIA_DISTRICTS = {
  'Andhra Pradesh': [
    'Alluri Sitharama Raju','Anakapalli','Ananthapuramu','Annamayya','Bapatla','Chittoor','Dr. B. R. Ambedkar Konaseema','East Godavari','Eluru','Guntur','Kakinada','Krishna','Kurnool','Nandyal','NTR','Palnadu','Parvathipuram Manyam','Prakasam','Sri Potti Sriramulu Nellore','Sri Sathya Sai','Srikakulam','Tirupati','Visakhapatnam','Vizianagaram','West Godavari','YSR Kadapa'
  ],
  'Arunachal Pradesh': [
    'Anjaw','Bichom','Changlang','Dibang Valley','East Kameng','East Siang','Itanagar Capital Complex','Kamle','Keyi Panyor','Kra Daadi','Kurung Kumey','Lohit','Longding','Lower Dibang Valley','Lower Siang','Lower Subansiri','Namsai','Pakke Kessang','Papum Pare','Shi Yomi','Siang','Tawang','Tirap','Upper Dibang Valley','Upper Siang','Upper Subansiri','West Kameng','West Siang'
  ],
  'Assam': [
    'Baksa','Bajali','Barpeta','Biswanath','Bongaigaon','Cachar','Charaideo','Chirang','Darrang','Dhemaji','Dhubri','Dibrugarh','Dima Hasao','Goalpara','Golaghat','Hailakandi','Hojai','Jorhat','Kamrup','Kamrup Metropolitan','Karbi Anglong','Kokrajhar','Lakhimpur','Majuli','Marigaon','Nagaon','Nalbari','Sivasagar','Sonitpur','South Salmara-Mankachar','Tamulpur','Tinsukia','Udalguri','West Karbi Anglong'
  ],
  'Bihar': [
    'Araria','Arwal','Aurangabad','Banka','Begusarai','Bhagalpur','Bhojpur','Buxar','Darbhanga','East Champaran','Gaya','Gopalganj','Jamui','Jehanabad','Kaimur','Katihar','Khagaria','Kishanganj','Lakhisarai','Madhepura','Madhubani','Munger','Muzaffarpur','Nalanda','Nawada','Patna','Purnia','Rohtas','Saharsa','Samastipur','Saran','Sheikhpura','Sheohar','Sitamarhi','Siwan','Supaul','Vaishali','West Champaran'
  ],
  'Chhattisgarh': [
    'Balod','Baloda Bazar-Bhatapara','Balrampur-Ramanujganj','Bastar','Bemetara','Bijapur','Bilaspur','Dantewada','Dhamtari','Durg','Gariaband','Gaurela-Pendra-Marwahi','Janjgir-Champa','Jashpur','Kabirdham','Kanker','Kondagaon','Korba','Koriya','Khairagarh-Chhuikhadan-Gandai','Mahasamund','Manendragarh-Chirmiri-Bharatpur','Mohla-Manpur-Ambagarh Chouki','Mungeli','Narayanpur','Raigarh','Rajnandgaon','Raipur','Sakti','Sarangarh-Bilaigarh','Sukma','Surajpur','Surguja'
  ],
  'Goa': ['North Goa','South Goa'],
  'Gujarat': [
    'Ahmedabad','Amreli','Anand','Aravalli','Banaskantha','Bharuch','Bhavnagar','Botad','Chhota Udaipur','Dahod','Dang','Devbhumi Dwarka','Gandhinagar','Gir Somnath','Jamnagar','Junagadh','Kachchh','Kheda','Mahisagar','Mehsana','Morbi','Narmada','Navsari','Panchmahal','Patan','Porbandar','Rajkot','Sabarkantha','Surat','Surendranagar','Tapi','Vadodara','Valsad'
  ],
  'Haryana': [
    'Ambala','Bhiwani','Charkhi Dadri','Faridabad','Fatehabad','Gurugram','Hisar','Jhajjar','Jind','Kaithal','Karnal','Kurukshetra','Mahendragarh','Nuh','Palwal','Panchkula','Panipat','Rewari','Rohtak','Sirsa','Sonipat','Yamunanagar'
  ],
  'Himachal Pradesh': [
    'Bilaspur','Chamba','Hamirpur','Kangra','Kinnaur','Kullu','Lahaul and Spiti','Mandi','Shimla','Sirmaur','Solan','Una'
  ],
  'Jharkhand': [
    'Bokaro','Chatra','Deoghar','Dhanbad','Dumka','East Singhbhum','Garhwa','Giridih','Godda','Gumla','Hazaribagh','Jamtara','Khunti','Koderma','Latehar','Lohardaga','Pakur','Palamu','Ramgarh','Ranchi','Sahibganj','Saraikela Kharsawan','Simdega','West Singhbhum'
  ],
  'Karnataka': [
    'Bagalkot','Ballari','Belagavi','Bengaluru Rural','Bengaluru Urban','Bidar','Chamarajanagar','Chikkaballapur','Chikkamagaluru','Chitradurga','Dakshina Kannada','Davanagere','Dharwad','Gadag','Hassan','Haveri','Kalaburagi','Kodagu','Kolar','Koppal','Mandya','Mysuru','Raichur','Ramanagara','Shivamogga','Tumakuru','Udupi','Uttara Kannada','Vijayanagara','Vijayapura','Yadgir'
  ],
  'Kerala': [
    'Alappuzha','Ernakulam','Idukki','Kannur','Kasaragod','Kollam','Kottayam','Kozhikode','Malappuram','Palakkad','Pathanamthitta','Thiruvananthapuram','Thrissur','Wayanad'
  ],
  'Madhya Pradesh': [
    'Agar Malwa','Alirajpur','Anuppur','Ashoknagar','Balaghat','Barwani','Betul','Bhind','Bhopal','Burhanpur','Chhatarpur','Chhindwara','Damoh','Datia','Dewas','Dhar','Dindori','Guna','Gwalior','Harda','Narmadapuram','Indore','Jabalpur','Jhabua','Katni','Khandwa','Khargone','Maihar','Mandla','Mandsaur','Mauganj','Morena','Narsinghpur','Neemuch','Niwari','Pandhurna','Panna','Raisen','Rajgarh','Ratlam','Rewa','Sagar','Satna','Sehore','Seoni','Shahdol','Shajapur','Sheopur','Shivpuri','Sidhi','Singrauli','Tikamgarh','Ujjain','Umaria','Vidisha'
  ],
  'Maharashtra': [
    'Ahmednagar','Akola','Amravati','Aurangabad','Beed','Bhandara','Buldhana','Chandrapur','Dhule','Gadchiroli','Gondia','Hingoli','Jalgaon','Jalna','Kolhapur','Latur','Mumbai City','Mumbai Suburban','Nagpur','Nanded','Nandurbar','Nashik','Osmanabad','Palghar','Parbhani','Pune','Raigad','Ratnagiri','Sangli','Satara','Sindhudurg','Solapur','Thane','Wardha','Washim','Yavatmal'
  ],
  'Manipur': ['Bishnupur','Chandel','Churachandpur','Imphal East','Imphal West','Jiribam','Kakching','Kamjong','Kangpokpi','Noney','Pherzawl','Senapati','Tamenglong','Tengnoupal','Thoubal','Ukhrul'],
  'Meghalaya': ['East Garo Hills','East Jaintia Hills','East Khasi Hills','Eastern West Khasi Hills','North Garo Hills','Ri Bhoi','South Garo Hills','South West Garo Hills','South West Khasi Hills','West Garo Hills','West Jaintia Hills','West Khasi Hills'],
  'Mizoram': ['Aizawl','Champhai','Hnahthial','Khawzawl','Kolasib','Lawngtlai','Lunglei','Mamit','Saitual','Serchhip','Siaha'],
  'Nagaland': ['Chumoukedima','Dimapur','Kiphire','Kohima','Longleng','Mokokchung','Mon','Niuland','Noklak','Peren','Phek','Shamator','Tseminyu','Tuensang','Wokha','Zunheboto','Meluri'],
  'Odisha': [
    'Angul','Balangir','Balasore','Bargarh','Bhadrak','Boudh','Cuttack','Deogarh','Dhenkanal','Gajapati','Ganjam','Jagatsinghpur','Jajpur','Jharsuguda','Kalahandi','Kandhamal','Kendrapara','Kendujhar','Khordha','Koraput','Malkangiri','Mayurbhanj','Nabarangpur','Nayagarh','Nuapada','Puri','Rayagada','Sambalpur','Subarnapur','Sundargarh'
  ],
  'Punjab': [
    'Amritsar','Barnala','Bathinda','Faridkot','Fatehgarh Sahib','Fazilka','Ferozepur','Gurdaspur','Hoshiarpur','Jalandhar','Kapurthala','Ludhiana','Malerkotla','Mansa','Moga','Muktsar','Pathankot','Patiala','Rupnagar','Sahibzada Ajit Singh Nagar','Sangrur','Shaheed Bhagat Singh Nagar','Tarn Taran'
  ],
  'Rajasthan': [
    'Ajmer','Alwar','Anupgarh','Balotra','Banswara','Baran','Barmer','Beawar','Bharatpur','Bhilwara','Bikaner','Bundi','Chittorgarh','Churu','Dausa','Deeg','Dholpur','Didwana-Kuchamana','Dungarpur','Hanumangarh','Jaipur','Jaisalmer','Jalore','Jhalawar','Jhunjhunu','Jodhpur','Karauli','Khairthal-Tijara','Kota','Kekri','Nagaur','Neem Ka Thana','Pali','Phalodi','Pratapgarh','Rajsamand','Salumbar','Sawai Madhopur','Sikar','Sirohi','Sri Ganganagar','Tonk','Udaipur'
  ],
  'Sikkim': ['East Sikkim','North Sikkim','Pakyong','Soreng','South Sikkim','West Sikkim'],
  'Tamil Nadu': [
    'Ariyalur','Chengalpattu','Chennai','Coimbatore','Cuddalore','Dharmapuri','Dindigul','Erode','Kallakurichi','Kancheepuram','Karur','Krishnagiri','Madurai','Mayiladuthurai','Nagapattinam','Namakkal','Nilgiris','Perambalur','Pudukkottai','Ramanathapuram','Ranipet','Salem','Sivaganga','Tenkasi','Thanjavur','Theni','Thoothukudi','Tiruchirappalli','Tirunelveli','Tirupathur','Tiruppur','Tiruvallur','Tiruvannamalai','Tiruvarur','Vellore','Viluppuram','Virudhunagar'
  ],
  'Telangana': [
    'Adilabad','Bhadradri Kothagudem','Hanamkonda','Hyderabad','Jagtial','Jangaon','Jayashankar Bhupalapally','Jogulamba Gadwal','Kamareddy','Karimnagar','Khammam','Komaram Bheem','Mahabubabad','Mahbubnagar','Mancherial','Medak','Medchal-Malkajgiri','Mulugu','Nagarkurnool','Nalgonda','Narayanpet','Nirmal','Nizamabad','Peddapalli','Rajanna Sircilla','Rangareddy','Sangareddy','Siddipet','Suryapet','Vikarabad','Wanaparthy','Warangal','Yadadri Bhuvanagiri'
  ],
  'Tripura': ['Dhalai','Gomati','Khowai','North Tripura','Sepahijala','South Tripura','Unakoti','West Tripura'],
  'Uttar Pradesh': [
    'Agra','Aligarh','Ambedkar Nagar','Amroha','Auraiya','Ayodhya','Azamgarh','Baghpat','Bahraich','Ballia','Balrampur','Banda','Barabanki','Bareilly','Basti','Bhadohi','Bijnor','Budaun','Bulandshahr','Chandauli','Chitrakoot','Deoria','Etah','Etawah','Farrukhabad','Fatehpur','Firozabad','Gautam Buddha Nagar','Ghaziabad','Ghazipur','Gonda','Gorakhpur','Hamirpur','Hapur','Hardoi','Hathras','Jalaun','Jaunpur','Jhansi','Kannauj','Kanpur Dehat','Kanpur Nagar','Kasganj','Kaushambi','Kheri','Kushinagar','Lalitpur','Lucknow','Maharajganj','Mahoba','Mainpuri','Mathura','Mau','Meerut','Mirzapur','Moradabad','Muzaffarnagar','Pilibhit','Pratapgarh','Prayagraj','Raebareli','Rampur','Saharanpur','Sambhal','Sant Kabir Nagar','Shahjahanpur','Shamli','Shravasti','Siddharthnagar','Sitapur','Sonbhadra','Sultanpur','Unnao','Varanasi'
  ],
  'Uttarakhand': ['Almora','Bageshwar','Chamoli','Champawat','Dehradun','Haridwar','Nainital','Pauri Garhwal','Pithoragarh','Rudraprayag','Tehri Garhwal','Udham Singh Nagar','Uttarkashi'],
  'West Bengal': [
    'Alipurduar','Bankura','Paschim Bardhaman','Purba Bardhaman','Birbhum','Cooch Behar','Dakshin Dinajpur','Darjeeling','Hooghly','Howrah','Jalpaiguri','Jhargram','Kalimpong','Kolkata','Maldah','Murshidabad','Nadia','North 24 Parganas','South 24 Parganas','Paschim Medinipur','Purba Medinipur','Uttar Dinajpur','Siliguri'
  ],
  'Andaman and Nicobar Islands': ['Nicobar','North and Middle Andaman','South Andaman'],
  'Chandigarh': ['Chandigarh'],
  'Dadra and Nagar Haveli and Daman and Diu': ['Dadra and Nagar Haveli','Daman','Diu'],
  'Delhi': ['Central Delhi','East Delhi','New Delhi','North Delhi','North East Delhi','North West Delhi','Shahdara','South Delhi','South East Delhi','South West Delhi','West Delhi'],
  'Jammu and Kashmir': ['Anantnag','Bandipora','Baramulla','Budgam','Doda','Ganderbal','Jammu','Kathua','Kishtwar','Kulgam','Kupwara','Poonch','Pulwama','Rajouri','Ramban','Reasi','Samba','Shopian','Srinagar','Udhampur'],
  'Ladakh': ['Kargil','Leh'],
  'Lakshadweep': ['Lakshadweep'],
  'Puducherry': ['Karaikal','Mahe','Puducherry','Yanam']
};
const INDIA_STATES_AND_UTS = Object.keys(INDIA_DISTRICTS).sort((a,b) => a.localeCompare(b));

const WEATHER_OPTIONS = ['all', 'Clear', 'Partly Cloudy', 'Overcast', 'Rainy', 'Foggy', 'Windy', 'Stormy'];

// Application Global State
const state = {
  activeTab: 'dashboard',
  activeWeatherFilter: 'all',
  searchQuery: '',
  observations: [...FALLBACK_OBSERVATIONS],
  speciesList: [...FALLBACK_SPECIES],
  activeObservationDetail: null,
  currentPhotoBase64: '',
  communityPosts: [],
  currentProfile: null,
  currentSocialPost: null
};

// DOM Elements
const DOM = {
  navBtns: document.querySelectorAll('.nav-btn'),
  tabContents: document.querySelectorAll('.tab-content'),
  themeToggleBtn: document.getElementById('themeToggleBtn'),
  searchInput: document.getElementById('searchInput'),
  weatherPillsContainer: document.getElementById('weatherPillsContainer'),
  // Stats Counters
  statTotalSightings: document.getElementById('statTotalSightings'),
  statUniqueSpecies: document.getElementById('statUniqueSpecies'),
  statUniqueLocations: document.getElementById('statUniqueLocations'),
  statRecentCount: document.getElementById('statRecentCount'),
  // Input Form
  obsForm: document.getElementById('obsForm'),
  birdNameInput: document.getElementById('birdNameInput'),
  speciesSelect: document.getElementById('speciesSelect'),
  obsDateInput: document.getElementById('obsDateInput'),
  weatherSelect: document.getElementById('weatherSelect'),
  stateInput: document.getElementById('stateInput'),
  districtInput: document.getElementById('districtInput'),
  locationInput: document.getElementById('locationInput'),
  notesInput: document.getElementById('notesInput'),
  // Photo Upload Elements (live camera removed)
  photoUploadBox: document.getElementById('photoUploadBox'),
  photoFileInput: document.getElementById('photoFileInput'),
  choosePhotoBtn: document.getElementById('choosePhotoBtn'),
  changePhotoBtn: document.getElementById('changePhotoBtn'),
  removePhotoBtn: document.getElementById('removePhotoBtn'),
  photoUploadPlaceholder: document.getElementById('photoUploadPlaceholder'),
  photoUploadControls: document.getElementById('photoUploadControls'),
  photoPreviewImg: document.getElementById('photoPreviewImg'),
  photoBase64: document.getElementById('photoBase64'),
  // Records Table
  recordsCountTag: document.getElementById('recordsCountTag'),
  recordsTableBody: document.getElementById('recordsTableBody'),
  // Species & Reports
  speciesListContainer: document.getElementById('speciesListContainer'),
  addSpeciesBtn: document.getElementById('addSpeciesBtn'),
  newSpeciesNameInput: document.getElementById('newSpeciesNameInput'),
  newSpeciesCategoryInput: document.getElementById('newSpeciesCategoryInput'),
  reportsSummaryBox: document.getElementById('reportsSummaryBox'),
  // Detail Modal
  detailModal: document.getElementById('detailModal'),
  closeDetailModalBtn: document.getElementById('closeDetailModalBtn'),
  // Database Modal & Badge Controls
  dbStatusBadge: document.getElementById('dbStatusBadge'),
  dbStatusDot: document.getElementById('dbStatusDot'),
  dbStatusText: document.getElementById('dbStatusText'),
  dbModal: document.getElementById('dbModal'),
  closeDbModalBtn: document.getElementById('closeDbModalBtn'),
  dbModalActiveEngine: document.getElementById('dbModalActiveEngine'),
  dbModalSqlHealth: document.getElementById('dbModalSqlHealth'),
  dbModalSupabaseHealth: document.getElementById('dbModalSupabaseHealth'),
  selectSqlEngineBtn: document.getElementById('selectSqlEngineBtn'),
  selectSupabaseEngineBtn: document.getElementById('selectSupabaseEngineBtn'),
  syncDbBtn: document.getElementById('syncDbBtn'),
  initSupabaseBtn: document.getElementById('initSupabaseBtn'),
  toastContainer: document.getElementById('toastContainer'),
  communityFeed: document.getElementById('communityFeed'),
  refreshFeedBtn: document.getElementById('refreshFeedBtn'),
  notificationsBtn: document.getElementById('notificationsBtn'),
  notificationDot: document.getElementById('notificationDot'),
  socialModal: document.getElementById('socialModal'),
  socialModalContent: document.getElementById('socialModalContent'),
  closeSocialModalBtn: document.getElementById('closeSocialModalBtn'),
  profileModal: document.getElementById('profileModal'),
  profileModalContent: document.getElementById('profileModalContent'),
  closeProfileModalBtn: document.getElementById('closeProfileModalBtn'),
  messageModal: document.getElementById('messageModal'),
  messageModalContent: document.getElementById('messageModalContent'),
  closeMessageModalBtn: document.getElementById('closeMessageModalBtn'),
  notificationsModal: document.getElementById('notificationsModal'),
  notificationsModalContent: document.getElementById('notificationsModalContent'),
  closeNotificationsModalBtn: document.getElementById('closeNotificationsModalBtn'),
};

// State -> District dependent selectors.
function populateStateOptions(selectedState = '') {
  if (!DOM.stateInput || DOM.stateInput.tagName !== 'SELECT') return;
  DOM.stateInput.innerHTML = '<option value="">Select state / UT</option>' + INDIA_STATES_AND_UTS
    .map(name => `<option value="${escAttr(name)}"${name === selectedState ? ' selected' : ''}>${esc(name)}</option>`)
    .join('');
  populateDistrictOptions(selectedState, '');
}

function populateDistrictOptions(stateName, selectedDistrict = '') {
  if (!DOM.districtInput || DOM.districtInput.tagName !== 'SELECT') return;
  const districts = INDIA_DISTRICTS[stateName] || [];
  DOM.districtInput.innerHTML = '<option value="">Select district</option>' + districts
    .map(name => `<option value="${escAttr(name)}"${name === selectedDistrict ? ' selected' : ''}>${esc(name)}</option>`)
    .join('');
  DOM.districtInput.disabled = !stateName || districts.length === 0;
}

function escAttr(value) {
  return String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Helper Utilities
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerText = message;
  DOM.toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// Database Engine API Operations
async function fetchDBStatus() {
  try {
    const res = await birdlogFetch(`${API_BASE}/db/status`);
    if (res.ok) {
      const data = await res.json();
      const isSupabase = data.current_effective_engine === 'supabase';
      const activeLabel = isSupabase ? 'Supabase' : 'SQL (SQLite)';

      DOM.dbStatusText.innerText = `DB: ${activeLabel}`;
      DOM.dbModalActiveEngine.innerText = activeLabel;
      DOM.dbModalSqlHealth.innerText = data.sql_status;
      DOM.dbModalSupabaseHealth.innerText = data.supabase_status;
      DOM.dbModalSupabaseHealth.style.color = data.supabase_is_live ? '#10b981' : '#f59e0b';

      if (DOM.dbStatusDot) {
        DOM.dbStatusDot.className = `db-dot ${isSupabase ? 'supabase' : 'green'}`;
      }

      if (DOM.selectSqlEngineBtn && DOM.selectSupabaseEngineBtn) {
        DOM.selectSqlEngineBtn.style.border = data.active_engine === 'sql' ? '2px solid var(--accent-primary)' : '1px solid var(--glass-border)';
        DOM.selectSupabaseEngineBtn.style.border = data.active_engine === 'supabase' ? '2px solid var(--accent-primary)' : '1px solid var(--glass-border)';

        // Do not let users repeatedly click Supabase actions while the
        // backend is not configured or the connection is unavailable.
        const supabaseReady = Boolean(data.supabase_available && data.supabase_is_live);
        DOM.selectSupabaseEngineBtn.disabled = !supabaseReady;
        DOM.syncDbBtn.disabled = !supabaseReady;
        DOM.initSupabaseBtn.disabled = !supabaseReady;
        DOM.selectSupabaseEngineBtn.title = supabaseReady
          ? 'Use Supabase as the active storage engine'
          : 'Configure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env first';

        if (!supabaseReady && data.active_engine === 'sql') {
          DOM.dbModalSupabaseHealth.innerText = data.supabase_status || 'Configure Supabase in .env';
        }
      }
    }
  } catch (err) {
    DOM.dbStatusText.innerText = 'DB: Standby';
  }
}

async function switchDatabaseEngine(engine) {
  try {
    const res = await birdlogFetch(`${API_BASE}/db/switch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ engine })
    });
    const data = await res.json();
    if (res.ok) {
      showToast(data.message, 'success');
      await fetchDBStatus();
      await fetchObservations();
      await fetchSpecies();
    } else {
      showToast(data.error || 'Failed to switch database engine.', 'error');
    }
  } catch (err) {
    showToast('Network error while switching database engine.', 'error');
  }
}

async function syncDatabases() {
  try {
    DOM.syncDbBtn.innerText = '⏳ Syncing SQLite ↔ Supabase...';
    DOM.syncDbBtn.disabled = true;
    const res = await birdlogFetch(`${API_BASE}/db/sync`, { method: 'POST' });
    const data = await res.json();
    if (res.ok) {
      showToast(data.message, 'success');
      await fetchDBStatus();
      await fetchObservations();
    } else {
      showToast(data.error || 'Database sync failed.', 'error');
    }
  } catch (err) {
    showToast('Network error during database sync.', 'error');
  } finally {
    DOM.syncDbBtn.innerText = '🔄 Sync SQLite ↔ Supabase Records';
    DOM.syncDbBtn.disabled = true;
    fetchDBStatus();
  }
}

async function initializeSupabase() {
  try {
    DOM.initSupabaseBtn.innerText = '⏳ Initializing Supabase...';
    DOM.initSupabaseBtn.disabled = true;
    const res = await birdlogFetch(`${API_BASE}/db/supabase-init`, { method: 'POST' });
    const data = await res.json();
    if (res.ok) {
      showToast(data.message, 'success');
      await fetchDBStatus();
      await fetchObservations();
      await fetchSpecies();
    } else {
      showToast(data.error || 'Supabase initialization failed.', 'error');
    }
  } catch (err) {
    showToast('Network error while initializing Supabase.', 'error');
  } finally {
    DOM.initSupabaseBtn.innerText = '☁️ Initialize Supabase from SQLite';
    DOM.initSupabaseBtn.disabled = true;
    fetchDBStatus();
  }
}

// API Operations
async function fetchObservations() {
  try {
    const query = new URLSearchParams({
      search: state.searchQuery,
      weather: state.activeWeatherFilter,
      mine: '1'
    });
    const res = await birdlogFetch(`${API_BASE}/observations?${query}`);
    if (res.ok) {
      const data = await res.json();
      state.observations = data.observations || [];
    } else {
      filterLocalObservations();
    }
  } catch (err) {
    filterLocalObservations();
  }
  renderRecordsTable();
  updateStatsUI();
  renderReportsSummary();
}

function filterLocalObservations() {
  let filtered = [...state.observations];
  if (state.activeWeatherFilter && state.activeWeatherFilter !== 'all') {
    filtered = filtered.filter(r => r.weather === state.activeWeatherFilter);
  }
  if (state.searchQuery) {
    const q = state.searchQuery.toLowerCase();
    filtered = filtered.filter(r =>
      r.bird_name.toLowerCase().includes(q) ||
      r.species.toLowerCase().includes(q) ||
      (r.location && r.location.toLowerCase().includes(q)) ||
      (r.weather && r.weather.toLowerCase().includes(q)) ||
      (r.notes && r.notes.toLowerCase().includes(q))
    );
  }
  state.observations = filtered;
}

async function fetchSpecies() {
  try {
    const res = await birdlogFetch(`${API_BASE}/species`);
    if (res.ok) {
      const data = await res.json();
      if (data.species && data.species.length) state.speciesList = data.species;
    }
  } catch (err) {}
  populateSpeciesSelect();
  renderSpeciesList();
}

function updateStatsUI() {
  const total = state.observations.length;
  const uniqueSp = new Set(state.observations.map(r => r.species)).size;
  const uniqueLoc = new Set(state.observations.map(r => r.location).filter(Boolean)).size;

  DOM.statTotalSightings.innerText = total;
  DOM.statUniqueSpecies.innerText = uniqueSp;
  DOM.statUniqueLocations.innerText = uniqueLoc;
  DOM.statRecentCount.innerText = total;
}

// Rendering Functions
function renderWeatherPills() {
  if (!DOM.weatherPillsContainer) return;
  DOM.weatherPillsContainer.innerHTML = '';
  WEATHER_OPTIONS.forEach(w => {
    const pill = document.createElement('button');
    pill.className = `pill-btn ${state.activeWeatherFilter === w ? 'active' : ''}`;
    pill.innerText = w === 'all' ? 'All Weather Conditions' : w;
    pill.addEventListener('click', () => {
      state.activeWeatherFilter = w;
      renderWeatherPills();
      fetchObservations();
    });
    DOM.weatherPillsContainer.appendChild(pill);
  });
}

function populateSpeciesSelect() {
  if (!DOM.speciesSelect) return;
  // Species/type is intentionally a clean, readonly field. The browser's native
  // <select> popup can render as a black bar on some Edge/mobile configurations.
  // BirdLog now fills this field automatically from the bird name instead.
  DOM.speciesSelect.value = '';
  DOM.speciesSelect.placeholder = 'Type a bird name above';
  DOM.speciesSelect.readOnly = true;
  DOM.speciesSelect.setAttribute('aria-readonly', 'true');
  updateSpeciesTypeFromBirdName(false);
}

function normalizeBirdName(value) {
  return String(value || '').trim().toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, ' ');
}

function inferBirdSpeciesType(rawName) {
  const name = normalizeBirdName(rawName);
  if (!name) return '';

  // Exact/common names first.
  if (BIRD_TYPE_MAP[name]) return BIRD_TYPE_MAP[name];

  // Also match the catalogue maintained by the administrator.
  const catalogue = Array.isArray(state.speciesList) ? state.speciesList : [];
  const matched = catalogue.find(sp => normalizeBirdName(sp?.name) === name && BIRD_SPECIES_TYPES.includes(sp?.category));
  if (matched) return matched.category;

  const rules = [
    [/\b(eagle|hawk|kite|falcon|vulture|osprey)\b/i, 'Raptor'],
    [/\b(duck|goose|swan)\b/i, 'Waterfowl'],
    [/\b(owl)\b/i, 'Owl'],
    [/\b(parrot|parakeet|macaw|cockatoo)\b/i, 'Parrot'],
    [/\b(pigeon|dove)\b/i, 'Pigeon & Dove'],
    [/\b(kingfisher)\b/i, 'Kingfisher'],
    [/\b(woodpecker)\b/i, 'Woodpecker'],
    [/\b(hummingbird)\b/i, 'Hummingbird'],
    [/\b(flamingo)\b/i, 'Flamingo'],
    [/\b(cuckoo|koel|coucal)\b/i, 'Cuckoo'],
    [/\b(hornbill)\b/i, 'Hornbill'],
    [/\b(bee[- ]eater)\b/i, 'Bee-eater'],
    [/\b(roller)\b/i, 'Roller'],
    [/\b(sunbird)\b/i, 'Sunbird'],
    [/\b(heron|egret|stork|ibis|crane|spoonbill)\b/i, 'Wading Bird'],
    [/\b(gull|tern|cormorant|booby|albatross|pelican)\b/i, 'Seabird'],
    [/\b(peafowl|peacock|pheasant|quail|partridge)\b/i, 'Gamebird'],
    [/\b(crow|sparrow|myna|bulbul|robin|tailorbird|babbler|warbler|wren|finch|swallow|starling|magpie|drongo)\b/i, 'Passerine']
  ];
  for (const [regex, candidate] of rules) {
    if (regex.test(name)) return candidate;
  }
  return '';
}

function updateSpeciesTypeFromBirdName(forceFallback = false) {
  const bird = document.getElementById('birdNameInput');
  const species = document.getElementById('speciesSelect');
  if (!bird || !species) return '';

  const type = inferBirdSpeciesType(bird.value);
  species.value = type || (forceFallback && normalizeBirdName(bird.value) ? 'Other' : '');
  species.setAttribute('value', species.value);
  species.dataset.autoSpecies = species.value;
  return species.value;
}

// Public handler used by both normal listeners and the inline form event.
window.birdLogAutoSpecies = function(value) {
  const bird = document.getElementById('birdNameInput');
  if (bird && value !== undefined && bird.value !== value) bird.value = value;
  return updateSpeciesTypeFromBirdName(false);
};

const PALETTE = ['#5b2a9e', '#ff8a4c', '#12a4ff', '#ee0a86', '#ffc93c', '#22c55e'];
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function renderSpeciesList() {
  const icons = ['🐦', '🦅', '🦆', '🦜', '🦉', '🕊️'];
  DOM.speciesListContainer.innerHTML = state.speciesList.map((sp, i) => `
    <div class="row-card">
      <span class="sp-ico" style="background:${PALETTE[i % PALETTE.length]}">${icons[i % icons.length]}</span>
      <div class="row-main"><strong>${esc(sp.name)}</strong><small>${esc(sp.category || 'General')}</small></div>
    </div>`).join('');
}

function obsRow(r, withDelete) {
  return `
    <div class="row-card view-obs-btn" data-id="${esc(r.id)}">
      ${r.photo_url ? `<img class="thumb" src="${esc(r.photo_url)}" alt="">` : '<div class="thumb no-photo-thumb">📷</div>'}
      <div class="row-main">
        <strong>${esc(r.bird_name)}</strong>
        <small>📍 ${esc(r.location || 'Unspecified')} · ${esc(r.obs_date || 'N/A')}</small>
      </div>
      <span class="weather-badge">${esc(r.weather || 'Clear')}</span>
      ${withDelete ? `<button class="btn-delete delete-obs-btn" data-id="${esc(r.id)}" title="Delete">🗑</button>` : ''}
    </div>`;
}

function renderRecordsTable() {
  DOM.recordsCountTag.innerText = `${state.observations.length} Sightings`;
  const empty = '<div class="empty">No bird observations found.</div>';

  DOM.recordsTableBody.innerHTML = state.observations.length
    ? state.observations.map(r => obsRow(r, true)).join('') : empty;
  const recent = document.getElementById('recentList');
  if (recent) recent.innerHTML = state.observations.length
    ? state.observations.slice(0, 3).map(r => obsRow(r, false)).join('') : empty;

  document.querySelectorAll('.view-obs-btn').forEach(el => {
    el.addEventListener('click', () => openDetailModal(el.dataset.id));
  });
  document.querySelectorAll('.delete-obs-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!confirm('Delete this observation record?')) return;
      const id = btn.dataset.id;
      try { await birdlogFetch(`${API_BASE}/observations/${id}`, { method: 'DELETE' }); } catch (err) {}
      state.observations = state.observations.filter(o => o.id !== id);
      showToast('Observation deleted.', 'success');
      fetchObservations();
    });
  });
}

function renderReportsSummary() {
  const counts = {};
  state.observations.forEach(r => { counts[r.species] = (counts[r.species] || 0) + 1; });
  const entries = Object.entries(counts);
  const total = state.observations.length;
  if (!total) { DOM.reportsSummaryBox.innerHTML = '<div class="empty">No sightings yet.</div>'; return; }

  let acc = 0;
  const stops = entries.map(([, n], i) => {
    const from = acc; acc += (n / total) * 100;
    return `${PALETTE[i % PALETTE.length]} ${from}% ${acc}%`;
  }).join(', ');

  DOM.reportsSummaryBox.innerHTML = `
    <div class="donut-wrap"><div class="donut" style="background:conic-gradient(${stops})">
      <div><b>${total}</b><span>Sightings</span></div></div></div>
    <div class="legend">${entries.map(([sp, n], i) => `
      <div class="legend-row"><i style="background:${PALETTE[i % PALETTE.length]}"></i>
        <span>${esc(sp)}</span><b>${n} · ${Math.round(n / total * 100)}%</b></div>`).join('')}
    </div>`;
}

// ---------------------------------------------------------------------------
// Bird Community / Instagram-style feed
// ---------------------------------------------------------------------------
function avatarInitial(user) {
  const text = (user && (user.username || user.full_name)) || 'B';
  return esc(text.slice(0, 1).toUpperCase());
}

function formatRelativeTime(value) {
  if (!value) return 'Just now';
  const t = new Date(value).getTime();
  if (Number.isNaN(t)) return value;
  const diff = Math.max(0, Date.now() - t);
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'Just now';
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const days = Math.floor(hr / 24);
  if (days < 7) return `${days}d`;
  return new Date(value).toLocaleDateString();
}

function renderCommunityFeed(posts = state.communityPosts) {
  if (!DOM.communityFeed) return;
  if (!posts.length) {
    DOM.communityFeed.innerHTML = '<div class="community-empty"><div>🦜</div><strong>No bird posts yet</strong><span>Capture your first sighting to share it with the community.</span></div>';
    return;
  }
  DOM.communityFeed.innerHTML = posts.map(post => `
    <article class="social-post" data-post-id="${esc(post.id)}">
      <div class="post-header">
        <button class="post-user" data-profile-id="${esc(post.author?.id || '')}">
          <span class="community-avatar">${avatarInitial(post.author)}</span>
          <span class="post-user-meta"><strong>${esc(post.author?.full_name || 'Bird Watcher')}</strong><small>@${esc(post.author?.username || 'birdwatcher')} · ${esc(formatRelativeTime(post.created_at))}</small></span>
        </button>
      </div>
      ${post.photo_url ? `<button class="post-image-btn" data-detail-id="${esc(post.id)}"><img class="post-image" src="${esc(post.photo_url)}" alt="${esc(post.bird_name || 'Bird')}" loading="lazy"></button>` : ''}
      <div class="post-body">
        <div class="post-actions">
          <button class="post-action ${post.liked ? 'active-like' : ''}" type="button" aria-label="Like this post" data-like-id="${esc(post.id)}">${post.liked ? '❤️' : '🤍'} <span>${post.like_count || 0}</span></button>
          <button class="post-action" type="button" aria-label="Comment on this post" data-comment-id="${esc(post.id)}">💬 <span>${post.comment_count || 0}</span></button>
          <button class="post-action" type="button" aria-label="Share this post" data-share-id="${esc(post.id)}">📤</button>
          <button class="post-more" type="button" aria-label="Report this post" data-report-id="${esc(post.id)}" title="Report post">⋯</button>
        </div>
        <div class="post-title"><strong>${esc(post.bird_name || 'Bird sighting')}</strong> <span>${esc(post.species || '')}</span></div>
        <p class="post-caption"><button class="inline-profile-link" data-profile-id="${esc(post.author?.id || '')}">@${esc(post.author?.username || 'birdwatcher')}</button> ${esc(post.caption || '')}</p>
        <p class="post-meta">📍 ${esc(post.location || 'Field observation')}${post.district ? `, ${esc(post.district)}` : ''}${post.state ? `, ${esc(post.state)}` : ''}</p>
        <div class="post-tags">${esc(post.hashtags || '#BirdWatching #BirdLog')}</div>
      </div>
    </article>
  `).join('');
}

async function fetchCommunityFeed() {
  if (!DOM.communityFeed) return;
  try {
    const query = encodeURIComponent(state.searchQuery || '');
    const res = await birdlogFetch(`${API_BASE}/community/posts?search=${query}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Unable to load community posts.');
    state.communityPosts = data.posts || [];
    if (data.current_user_id) window.BIRDLOG_CURRENT_USER_ID = data.current_user_id;
    renderCommunityFeed();
  } catch (err) {
    console.error(err);
    DOM.communityFeed.innerHTML = `<div class="community-empty error"><div>⚠️</div><strong>Community feed unavailable</strong><span>${esc(err.message || 'Please try again.')}</span></div>`;
  }
}

async function openPostComments(postId) {
  const post = state.communityPosts.find(p => p.id === postId);
  if (!post || !DOM.socialModal) return;
  state.currentSocialPost = post;
  DOM.socialModalContent.innerHTML = `
    <h2>Comments</h2>
    <p class="social-modal-sub">${esc(post.bird_name || 'Bird post')}</p>
    <div id="commentsList" class="comments-list"><div class="empty">Loading…</div></div>
    <div class="comment-compose"><input id="commentInput" class="form-control" placeholder="Write a comment…"><button class="btn-primary btn-sm" id="sendCommentBtn">Post</button></div>`;
  DOM.socialModal.classList.add('active');
  const refreshComments = async () => {
    const res = await birdlogFetch(`${API_BASE}/community/posts/${encodeURIComponent(postId)}/comments`);
    const data = await res.json();
    const list = document.getElementById('commentsList');
    if (!list) return;
    list.innerHTML = (data.comments || []).map(c => `<div class="comment-row"><div class="community-avatar small">${esc((c.username || 'B').slice(0,1).toUpperCase())}</div><div><b>@${esc(c.username || 'birdwatcher')}</b><p>${esc(c.comment)}</p><small>${esc(formatRelativeTime(c.created_at))}</small></div></div>`).join('') || '<div class="empty">No comments yet.</div>';
  };
  await refreshComments();
  document.getElementById('sendCommentBtn')?.addEventListener('click', async () => {
    const input = document.getElementById('commentInput');
    const comment = input?.value.trim();
    if (!comment) return;
    const res = await birdlogFetch(`${API_BASE}/community/posts/${encodeURIComponent(postId)}/comments`, {method:'POST', credentials:'include', headers:{'Content-Type':'application/json'}, body:JSON.stringify({comment})});
    const data = await res.json();
    if (!res.ok) return showToast(data.error || 'Unable to comment.', 'error');
    input.value = '';
    await refreshComments();
    fetchCommunityFeed();
  });
}

async function openProfile(userId) {
  if (!userId || !DOM.profileModal) return;
  try {
    const res = await birdlogFetch(`${API_BASE}/community/users/${encodeURIComponent(userId)}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Profile unavailable.');
    const u = data.user;
    const isOtherUser = u.id !== window.BIRDLOG_CURRENT_USER_ID && u.id !== 'system_birdlog';
    const contactEmail = (u.email && u.email !== 'system@birdlog.local') ? u.email : '';
    DOM.profileModalContent.innerHTML = `
      <div class="profile-head">
        <div class="profile-avatar">${avatarInitial(u)}</div>
        <span class="profile-handle">@${esc(u.username || 'birdwatcher')}</span>
        <h2>${esc(u.full_name || 'Bird Watcher')}</h2>
      </div>
      <div class="profile-stats profile-stats-two">
        <div><b>${u.post_count || 0}</b><span>Posts</span></div>
        <div><b>${esc(u.created_at ? new Date(u.created_at).toLocaleDateString() : '—')}</b><span>Joined</span></div>
      </div>
      ${isOtherUser ? `
        <div class="profile-contact-card">
          <div class="profile-contact-title">📇 Contact Details</div>
          <div class="profile-contact-row"><span>👤 Username</span><b>@${esc(u.username || 'birdwatcher')}</b></div>
          ${contactEmail ? `<div class="profile-contact-row"><span>✉️ Email</span><a href="mailto:${esc(contactEmail)}">${esc(contactEmail)}</a></div>` : '<div class="profile-contact-row muted">Email not provided</div>'}
        </div>
        <button class="btn-primary profile-message-btn" id="profileMessageBtn">💬 Message</button>
      ` : '<div class="profile-own">This is your community profile</div>'}`;
    DOM.profileModal.classList.add('active');
    document.getElementById('profileMessageBtn')?.addEventListener('click', () => {
      DOM.profileModal.classList.remove('active');
      openMessageChat(u);
    });
  } catch (err) { showToast(err.message || 'Unable to open profile.', 'error'); }
}

async function openMessageChat(user) {
  if (!user || user.id === window.BIRDLOG_CURRENT_USER_ID || user.id === 'system_birdlog' || !DOM.messageModal) return;
  DOM.messageModalContent.innerHTML = `
    <div class="message-head">
      <div class="community-avatar">${avatarInitial(user)}</div>
      <div><h2 style="margin:0">${esc(user.full_name || 'Bird Watcher')}</h2><span class="profile-handle">@${esc(user.username || 'birdwatcher')}</span></div>
    </div>
    <div id="messageList" class="message-list"><div class="empty">Loading…</div></div>
    <div class="message-compose"><input id="messageInput" class="form-control" maxlength="1000" placeholder="Write a message…"><button class="btn-primary btn-sm" id="sendMessageBtn">Send</button></div>`;
  DOM.messageModal.classList.add('active');
  const list = document.getElementById('messageList');
  const input = document.getElementById('messageInput');
  const sendBtn = document.getElementById('sendMessageBtn');

  const refreshMessages = async () => {
    const res = await birdlogFetch(`${API_BASE}/community/users/${encodeURIComponent(user.id)}/messages`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Unable to load messages.');
    list.innerHTML = (data.messages || []).map(m => `
      <div class="message-bubble ${m.sender_id === window.BIRDLOG_CURRENT_USER_ID ? 'mine' : 'theirs'}">
        <div>${esc(m.message)}</div><small>${esc(formatRelativeTime(m.created_at))}</small>
      </div>`).join('') || '<div class="empty">No messages yet. Say hello 👋</div>';
    list.scrollTop = list.scrollHeight;
  };

  try {
    await refreshMessages();
    const send = async () => {
      const message = input?.value.trim();
      if (!message) return;
      sendBtn.disabled = true;
      try {
        const res = await birdlogFetch(`${API_BASE}/community/users/${encodeURIComponent(user.id)}/messages`, {
          method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({message})
        });
        const data = await res.json();
        if (!res.ok) return showToast(data.error || 'Unable to send message.', 'error');
        input.value = '';
        await refreshMessages();
      } catch (err) { showToast(err.message || 'Unable to send message.', 'error'); }
      finally { sendBtn.disabled = false; input?.focus(); }
    };
    sendBtn?.addEventListener('click', send);
    input?.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); send(); } });
  } catch (err) {
    list.innerHTML = `<div class="community-empty error"><div>⚠️</div><strong>Messages unavailable</strong><span>${esc(err.message || 'Please try again.')}</span></div>`;
  }
}

async function openNotifications() {
  if (!DOM.notificationsModal) return;
  try {
    const res = await birdlogFetch(`${API_BASE}/community/notifications?mark_read=1`);
    const data = await res.json();
    DOM.notificationsModalContent.innerHTML = `<h2>Notifications</h2><p class="social-modal-sub">Likes, comments, messages and same-bird sightings</p><div class="notifications-list">${(data.notifications || []).map(n => `<div class="notification-row"><div class="community-avatar small">🔔</div><div><b>@${esc(n.username || 'birdwatcher')}</b> ${esc(n.text)}<small>${esc(formatRelativeTime(n.created_at))}</small></div></div>`).join('') || '<div class="empty">No new notifications.</div>'}</div>`;
    DOM.notificationsModal.classList.add('active');
    if (DOM.notificationDot) DOM.notificationDot.style.display = 'none';
  } catch (_) { showToast('Unable to load notifications.', 'error'); }
}

let communityNotificationBaselineReady = false;
let communityNotificationIds = new Set();

function showFloatingNotification(n) {
  if (!n) return;
  const actor = n.username ? `@${n.username}` : 'Another bird watcher';
  const message = n.event_type === 'same_bird_existing'
    ? `${n.text}`
    : `${actor} ${n.text}`;
  showToast(`🔔 ${message}`, 'info');
}

async function checkCommunityNotifications() {
  try {
    const res = await birdlogFetch(`${API_BASE}/community/notifications`);
    const data = await res.json();
    if (!res.ok) return;
    if (DOM.notificationDot) DOM.notificationDot.style.display = data.unread > 0 ? 'block' : 'none';

    const notifications = Array.isArray(data.notifications) ? data.notifications : [];
    const currentIds = new Set(notifications.map(n => String(n.id)));

    // The first request establishes the baseline. Only notifications arriving
    // after that request are shown as floating alerts, so old notifications do
    // not suddenly pop up when the user logs in or refreshes the page.
    if (!communityNotificationBaselineReady) {
      communityNotificationIds = currentIds;
      communityNotificationBaselineReady = true;
      return;
    }

    const fresh = notifications
      .filter(n => !communityNotificationIds.has(String(n.id)))
      .reverse();

    communityNotificationIds = currentIds;
    fresh.forEach(showFloatingNotification);
  } catch (_) {}
}

function setupCommunityFeedEvents() {
  DOM.communityFeed?.addEventListener('click', async (e) => {
    const likeBtn = e.target.closest('[data-like-id]');
    const commentBtn = e.target.closest('[data-comment-id]');
    const shareBtn = e.target.closest('[data-share-id]');
    const reportBtn = e.target.closest('[data-report-id]');
    const profileBtn = e.target.closest('[data-profile-id]');
    const detailBtn = e.target.closest('[data-detail-id]');
    if (likeBtn) {
      try {
        const res = await birdlogFetch(`${API_BASE}/community/posts/${encodeURIComponent(likeBtn.dataset.likeId)}/like`, {method:'POST', credentials:'include'});
        const d = await res.json().catch(() => ({}));
        if (!res.ok) return showToast(d.error || 'Unable to like.', 'error');
        await fetchCommunityFeed();
      } catch (err) { showToast('Unable to connect to the server.', 'error'); }
      return;
    }
    if (commentBtn) return openPostComments(commentBtn.dataset.commentId);
    if (shareBtn) {
      const id = shareBtn.dataset.shareId;
      const url = `${location.origin}/app#post-${id}`;
      try {
        if (navigator.share) {
          await navigator.share({title:'BirdLog Community', text:'Check out this bird sighting on BirdLog.', url});
          showToast('Post shared.', 'success');
        } else if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(url);
          showToast('Post link copied.', 'success');
        } else {
          const ta = document.createElement('textarea');
          ta.value = url; ta.style.position = 'fixed'; ta.style.left = '-9999px';
          ta.setAttribute('readonly', '');
          document.body.appendChild(ta); ta.select();
          const copied = document.execCommand('copy'); ta.remove();
          if (copied) {
            showToast('Post link copied.', 'success');
          } else {
            window.prompt('Copy this BirdLog post link:', url);
          }
        }
      } catch (err) {
        if (err && err.name !== 'AbortError') {
          try { window.prompt('Copy this BirdLog post link:', url); }
          catch (_) { showToast('Unable to share this post.', 'error'); }
        }
      }
      return;
    }
    if (reportBtn) {
      const reason = prompt('Why are you reporting this post?', 'Inappropriate content');
      if (!reason) return;
      try {
        const res = await birdlogFetch(`${API_BASE}/community/posts/${encodeURIComponent(reportBtn.dataset.reportId)}/report`, {method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({reason})});
        const d = await res.json().catch(() => ({}));
        showToast(res.ok ? 'Report sent to BirdLog moderation.' : (d.error || 'Unable to report.'), res.ok ? 'success' : 'error');
      } catch (err) {
        showToast('Unable to connect to BirdLog server.', 'error');
      }
      return;
    }
    if (profileBtn) return openProfile(profileBtn.dataset.profileId);
    if (detailBtn) {
      const post = state.communityPosts.find(p => p.id === detailBtn.dataset.detailId);
      if (post) openPostComments(post.id);
    }
  });
}

// Modal Handlers
function openDetailModal(obsId) {
  const obs = state.observations.find(r => r.id === obsId);
  if (!obs) return;

  state.activeObservationDetail = obs;
  const detailPhoto = document.getElementById('detailModalPhoto');
  detailPhoto.src = obs.photo_url || '';
  detailPhoto.style.display = obs.photo_url ? 'block' : 'none';
  document.getElementById('detailModalSpecies').innerText = obs.species;
  document.getElementById('detailModalBirdName').innerText = obs.bird_name;
  document.getElementById('detailModalDate').innerText = obs.obs_date || 'N/A';
  document.getElementById('detailModalWeather').innerText = obs.weather || 'Clear';
  document.getElementById('detailModalLocation').innerText = `${obs.location || ''} ${obs.district ? '(' + obs.district + ', ' + obs.state + ')' : ''}`;
  document.getElementById('detailModalNotes').innerText = obs.notes || 'No additional field notes recorded.';

  DOM.detailModal.classList.add('active');
}

// Live Camera Photo Manager — camera capture is required for every new sighting.
let cameraStream = null;

function setCapturedPhoto(dataUrl, message) {
  if (!dataUrl || !String(dataUrl).startsWith('data:image/')) {
    showToast('Could not capture the camera image. Please try again.', 'error');
    return;
  }
  state.currentPhotoBase64 = dataUrl;
  if (DOM.photoBase64) DOM.photoBase64.value = dataUrl;

  const preview = document.getElementById('photoPreviewImg');
  const video = document.getElementById('cameraVideo');
  const placeholder = document.getElementById('photoUploadPlaceholder');
  const cameraControls = document.getElementById('cameraControls');
  const capturedControls = document.getElementById('capturedPhotoControls');
  const saveBtn = document.getElementById('saveObsBtn');

  if (preview) {
    preview.src = dataUrl;
    preview.style.display = 'block';
  }
  if (video) {
    video.pause();
    video.srcObject = null;
    video.style.display = 'none';
  }
  if (placeholder) placeholder.style.display = 'none';
  if (cameraControls) cameraControls.style.display = 'none';
  if (capturedControls) capturedControls.style.display = 'flex';
  if (saveBtn) saveBtn.disabled = false;

  stopLiveCamera(false);
  DOM.photoUploadBox?.classList.remove('camera-live');
  showToast(message || 'Photo captured successfully!', 'success');
}

function clearCapturedPhoto() {
  state.currentPhotoBase64 = '';
  if (DOM.photoBase64) DOM.photoBase64.value = '';

  const preview = document.getElementById('photoPreviewImg');
  const video = document.getElementById('cameraVideo');
  const placeholder = document.getElementById('photoUploadPlaceholder');
  const cameraControls = document.getElementById('cameraControls');
  const capturedControls = document.getElementById('capturedPhotoControls');
  const saveBtn = document.getElementById('saveObsBtn');

  if (preview) {
    preview.src = '';
    preview.style.display = 'none';
  }
  if (video) {
    video.pause();
    video.srcObject = null;
    video.style.display = 'none';
  }
  if (placeholder) placeholder.style.display = 'block';
  if (cameraControls) cameraControls.style.display = 'none';
  if (capturedControls) capturedControls.style.display = 'none';
  if (saveBtn) saveBtn.disabled = true;
  DOM.photoUploadBox?.classList.remove('camera-live');
}

function stopLiveCamera(resetPreview = true) {
  const stream = cameraStream;
  cameraStream = null;

  if (stream) {
    stream.getTracks().forEach(track => {
      try { track.stop(); } catch (_) {}
    });
  }

  const video = document.getElementById('cameraVideo');
  if (video) {
    try { video.pause(); } catch (_) {}
    try { video.srcObject = null; } catch (_) {}
    video.style.display = 'none';
  }

  DOM.photoUploadBox?.classList.remove('camera-live');

  if (resetPreview && !state.currentPhotoBase64) {
    const placeholder = document.getElementById('photoUploadPlaceholder');
    const controls = document.getElementById('cameraControls');
    const capturedControls = document.getElementById('capturedPhotoControls');
    if (placeholder) placeholder.style.display = 'block';
    if (controls) controls.style.display = 'none';
    if (capturedControls) capturedControls.style.display = 'none';
    const saveBtn = document.getElementById('saveObsBtn');
    if (saveBtn) saveBtn.disabled = true;
  }
}

async function openLiveCamera() {
  if (!window.isSecureContext || !navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
    showToast('Camera needs HTTPS (or localhost). Open the deployed HTTPS link and allow Camera permission.', 'error');
    return false;
  }

  stopLiveCamera(true);
  clearCapturedPhoto();

  let stream;
  try {
    const constraints = {
      audio: false,
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }
    };
    try {
      stream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (_) {
      stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
    }
  } catch (error) {
    const reason =
      error?.name === 'NotAllowedError' ? 'Camera permission was denied. Allow camera access for this site and try again.' :
      error?.name === 'NotFoundError' ? 'No camera was found on this device.' :
      error?.name === 'NotReadableError' ? 'The camera is busy or unavailable. Close other apps using the camera and try again.' :
      'Unable to open the camera. Use HTTPS or localhost and check camera permission.';
    showToast(reason, 'error');
    return false;
  }

  cameraStream = stream;
  const video = document.getElementById('cameraVideo');
  const box = document.getElementById('photoUploadBox');
  const placeholder = document.getElementById('photoUploadPlaceholder');
  const controls = document.getElementById('cameraControls');
  const capturedControls = document.getElementById('capturedPhotoControls');
  const preview = document.getElementById('photoPreviewImg');
  const saveBtn = document.getElementById('saveObsBtn');

  if (!video || !box || !controls) {
    stopLiveCamera(true);
    showToast('Camera interface could not be initialized.', 'error');
    return false;
  }

  video.setAttribute('autoplay', '');
  video.setAttribute('playsinline', '');
  video.setAttribute('muted', '');
  video.muted = true;
  video.autoplay = true;
  video.playsInline = true;
  video.srcObject = stream;
  video.style.display = 'block';
  video.removeAttribute('hidden');
  if (preview) preview.style.display = 'none';
  if (placeholder) placeholder.style.display = 'none';
  controls.style.display = 'flex';
  if (capturedControls) capturedControls.style.display = 'none';
  if (saveBtn) saveBtn.disabled = true;
  box.classList.add('camera-live');

  // Start playback and wait for an actual frame. Do not mark the camera ready
  // merely because getUserMedia returned a MediaStream.
  const tryPlay = async () => {
    try { await video.play(); } catch (_) {}
  };
  await tryPlay();
  if (!video.videoWidth || !video.videoHeight) {
    await new Promise(resolve => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        video.removeEventListener('loadedmetadata', finish);
        video.removeEventListener('loadeddata', finish);
        video.removeEventListener('canplay', finish);
        resolve();
      };
      video.addEventListener('loadedmetadata', finish, { once: true });
      video.addEventListener('loadeddata', finish, { once: true });
      video.addEventListener('canplay', finish, { once: true });
      setTimeout(finish, 3500);
    });
    await tryPlay();
  }

  // Some Edge/mobile builds expose dimensions only after the first frame.
  const deadline = Date.now() + 3000;
  while (Date.now() < deadline && (!video.videoWidth || !video.videoHeight)) {
    await tryPlay();
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  if (!cameraStream) return false;
  if (!video.videoWidth || !video.videoHeight) {
    showToast('Camera permission was granted, but the browser is not delivering a live video frame. Check the site camera permission and try again.', 'error');
    return false;
  }

  showToast('Live camera ready. Point at the bird and tap Capture Photo.', 'success');
  return true;
}

async function captureLivePhoto() {
  const video = document.getElementById('cameraVideo');
  const canvas = document.getElementById('cameraCanvas');

  if (!cameraStream || !video || !canvas) {
    showToast('Open the live camera first.', 'error');
    return false;
  }

  try { await video.play(); } catch (_) {}

  // Give the browser a short opportunity to expose the first frame before
  // capturing. This prevents a black/zero-dimension frame on Edge/mobile.
  if (!video.videoWidth || !video.videoHeight) {
    await new Promise(resolve => setTimeout(resolve, 250));
    try { await video.play(); } catch (_) {}
  }

  // Normal browser path: capture the exact live frame shown in the video element.
  if (video.videoWidth > 0 && video.videoHeight > 0) {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) {
      showToast('Camera capture is not supported by this browser.', 'error');
      return false;
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    setCapturedPhoto(dataUrl);
    return true;
  }

  // Fallback for browsers where the MediaStream is live but the video element
  // has not exposed dimensions yet: capture directly from the camera track.
  const track = cameraStream.getVideoTracks?.()[0];
  if (track && typeof window.ImageCapture === 'function') {
    try {
      const imageCapture = new ImageCapture(track);
      const bitmap = await imageCapture.grabFrame();
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext('2d', { alpha: false });
      ctx.drawImage(bitmap, 0, 0, bitmap.width, bitmap.height);
      setCapturedPhoto(canvas.toDataURL('image/jpeg', 0.9));
      return true;
    } catch (_) {}
  }

  showToast('Live camera is not ready yet. Wait until the preview appears, then tap Capture again.', 'error');
  return false;
}

function closeLiveCamera() {
  stopLiveCamera(true);
  showToast('Camera closed. Capture a photo before saving.', 'info');
  return false;
}

// Global fallbacks are intentionally simple so mobile/Edge inline or delegated
// taps always call the same functions.
window.birdLogOpenCamera = openLiveCamera;
window.birdLogCapturePhoto = captureLivePhoto;
window.birdLogCloseCamera = closeLiveCamera;

function setupPhotoUpload() {
  const box = document.getElementById('photoUploadBox');
  if (!box) return;

  // Bind ONE click path only. Earlier versions used pointerup + click + direct
  // handlers together, so a single tap could execute Capture/Close twice.
  if (!window.__birdlogCameraClickHandlerInstalled) {
    window.__birdlogCameraClickHandlerInstalled = true;
    document.addEventListener('click', (event) => {
      const button = event.target?.closest?.('#openCameraBtn, #capturePhotoBtn, #stopCameraBtn, #retakePhotoBtn');
      if (!button) return;
      event.preventDefault();
      event.stopPropagation();
      if (button.id === 'openCameraBtn') {
        void openLiveCamera();
      } else if (button.id === 'capturePhotoBtn') {
        void captureLivePhoto();
      } else if (button.id === 'stopCameraBtn') {
        closeLiveCamera();
      } else if (button.id === 'retakePhotoBtn') {
        clearCapturedPhoto();
        void openLiveCamera();
      }
    }, true);
  }

  // Empty photo area opens the camera; buttons themselves are handled above.
  if (!box.__birdlogBoxClickBound) {
    box.__birdlogBoxClickBound = true;
    box.addEventListener('click', (event) => {
      if (event.target?.closest?.('button')) return;
      if (!cameraStream && !state.currentPhotoBase64) void openLiveCamera();
    });
  }

  if (!box.__birdlogBoxKeyBound) {
    box.__birdlogBoxKeyBound = true;
    box.addEventListener('keydown', (event) => {
      if ((event.key === 'Enter' || event.key === ' ') &&
          !cameraStream && !state.currentPhotoBase64) {
        event.preventDefault();
        void openLiveCamera();
      }
    });
  }
}

// Event Listeners Setup
function initEventListeners() {
  // Navigation Tabs
  DOM.navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      DOM.navBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const targetTab = btn.dataset.tab;
      state.activeTab = targetTab;

      DOM.tabContents.forEach(content => {
        content.style.display = content.id === `tab-${targetTab}` ? 'block' : 'none';
      });

      if (targetTab === 'dashboard') { fetchCommunityFeed(); checkCommunityNotifications(); }
      if (targetTab === 'records') fetchObservations();
      if (targetTab === 'species') fetchSpecies();
      if (targetTab === 'account') { window.dispatchEvent(new CustomEvent('birdlog-account-tab')); }
    });
  });

  document.getElementById('addMySightingBtn')?.addEventListener('click', () => {
    state.activeTab = 'add';
    DOM.tabContents.forEach(content => { content.style.display = content.id === 'tab-add' ? 'block' : 'none'; });
    DOM.navBtns.forEach(b => b.classList.remove('active'));
  });

  // Theme Toggle
  DOM.themeToggleBtn.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    DOM.themeToggleBtn.innerText = newTheme === 'dark' ? '☀️ Theme' : '🌙 Theme';
  });

  // Live Search Input
  let searchTimeout;
  DOM.searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      state.searchQuery = e.target.value.trim();
      if (state.activeTab === 'dashboard') fetchCommunityFeed();
      else fetchObservations();
    }, 250);
  });

  // Submit New Observation Form
  DOM.obsForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const capturedPhoto = state.currentPhotoBase64 || DOM.photoBase64?.value || '';
    if (!capturedPhoto.startsWith('data:image/')) {
      showToast('Please capture a photo using the live camera before saving.', 'error');
      return;
    }

    updateSpeciesTypeFromBirdName(true);
    if (!DOM.speciesSelect.value) {
      showToast('Please enter a bird name so the species type can be selected.', 'error');
      return;
    }

    const payload = {
      bird_name: DOM.birdNameInput.value.trim(),
      species: DOM.speciesSelect.value,
      obs_date: DOM.obsDateInput.value,
      weather: DOM.weatherSelect.value,
      state: DOM.stateInput.value.trim(),
      district: DOM.districtInput.value.trim(),
      location: DOM.locationInput.value.trim(),
      notes: DOM.notesInput.value.trim(),
      imageData: capturedPhoto
    };

    try {
      const response = await birdlogFetch(`${API_BASE}/observations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        let msg = 'Unable to save the bird observation.';
        try { const data = await response.json(); msg = data.error || msg; } catch (_) {}
        throw new Error(msg);
      }
      showToast('Bird observation recorded successfully!', 'success');
    } catch (err) {
      showToast(err.message || 'Unable to save the bird observation.', 'error');
      return;
    }
    DOM.obsForm.reset();
    clearCapturedPhoto();
    stopLiveCamera(true);
    
    // Set default date back to today
    DOM.obsDateInput.value = new Date().toISOString().split('T')[0];
    
    fetchObservations();
  });

  // Add Species Category (admin-only controls may not exist on the normal user page).
  // IMPORTANT: do not let a missing admin control abort the rest of initialization;
  // otherwise camera handlers and all remaining user-page events never get installed.
  if (DOM.addSpeciesBtn) {
    DOM.addSpeciesBtn.addEventListener('click', async () => {
      const name = DOM.newSpeciesNameInput?.value.trim() || '';
      const category = DOM.newSpeciesCategoryInput?.value.trim() || 'General';
      if (!name) return;

      const newSp = { id: `sp_${Date.now()}`, name, category };
      state.speciesList.push(newSp);

      try {
        await birdlogFetch(`${API_BASE}/species`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, category })
        });
      } catch (e) {}

      if (DOM.newSpeciesNameInput) DOM.newSpeciesNameInput.value = '';
      if (DOM.newSpeciesCategoryInput) DOM.newSpeciesCategoryInput.value = '';
      showToast('Species category added!', 'success');
      fetchSpecies();
    });
  }

  // Modal Closers
  DOM.closeDetailModalBtn.addEventListener('click', () => DOM.detailModal.classList.remove('active'));
  DOM.detailModal.addEventListener('click', (e) => {
    if (e.target === DOM.detailModal) DOM.detailModal.classList.remove('active');
  });

  // Database Settings Modal Event Listeners
  if (DOM.dbStatusBadge) {
    DOM.dbStatusBadge.addEventListener('click', () => {
      fetchDBStatus();
      DOM.dbModal.classList.add('active');
    });
  }

  if (DOM.closeDbModalBtn) {
    DOM.closeDbModalBtn.addEventListener('click', () => DOM.dbModal.classList.remove('active'));
  }

  if (DOM.dbModal) {
    DOM.dbModal.addEventListener('click', (e) => {
      if (e.target === DOM.dbModal) DOM.dbModal.classList.remove('active');
    });
  }

  if (DOM.selectSqlEngineBtn) {
    DOM.selectSqlEngineBtn.addEventListener('click', () => switchDatabaseEngine('sql'));
  }

  if (DOM.selectSupabaseEngineBtn) {
    DOM.selectSupabaseEngineBtn.addEventListener('click', () => switchDatabaseEngine('supabase'));
  }

  if (DOM.initSupabaseBtn) {
    DOM.initSupabaseBtn.addEventListener('click', () => initializeSupabase());
  }

  if (DOM.syncDbBtn) {
    DOM.syncDbBtn.addEventListener('click', () => syncDatabases());
  }

  // Bird name -> automatic species/type selection. Listen to input, keyup, paste and change
  // so typing on desktop, mobile keyboards, or paste all update the field immediately.
  const syncBirdSpecies = () => updateSpeciesTypeFromBirdName(false);
  DOM.birdNameInput?.addEventListener('input', syncBirdSpecies);
  DOM.birdNameInput?.addEventListener('keyup', syncBirdSpecies);
  DOM.birdNameInput?.addEventListener('change', () => updateSpeciesTypeFromBirdName(true));
  DOM.birdNameInput?.addEventListener('blur', () => updateSpeciesTypeFromBirdName(true));
  DOM.birdNameInput?.addEventListener('paste', () => setTimeout(syncBirdSpecies, 0));

  setupPhotoUpload();
  setupCommunityFeedEvents();
  DOM.refreshFeedBtn?.addEventListener('click', async () => {
    const btn = DOM.refreshFeedBtn;
    if (btn) { btn.disabled = true; btn.textContent = '↻ Refreshing…'; }
    try { await Promise.all([fetchCommunityFeed(), fetchObservations(), fetchSpecies()]); }
    finally { if (btn) { btn.disabled = false; btn.textContent = '↻ Refresh'; } }
  });
  DOM.notificationsBtn?.addEventListener('click', openNotifications);
  DOM.closeSocialModalBtn?.addEventListener('click', () => DOM.socialModal.classList.remove('active'));
  DOM.closeProfileModalBtn?.addEventListener('click', () => DOM.profileModal.classList.remove('active'));
  DOM.closeMessageModalBtn?.addEventListener('click', () => DOM.messageModal.classList.remove('active'));
  DOM.closeNotificationsModalBtn?.addEventListener('click', () => DOM.notificationsModal.classList.remove('active'));

}

// Render account-dependent community data only after the current user has
// been restored from the persistent server session.
window.addEventListener('birdlog-user-ready', () => {
  fetchCommunityFeed();
  checkCommunityNotifications();
});

// Populate the India State / UT list and make District dependent on State.
document.addEventListener('DOMContentLoaded', () => {
  if (DOM.stateInput && DOM.districtInput) {
    populateStateOptions();
    DOM.stateInput.addEventListener('change', () => {
      populateDistrictOptions(DOM.stateInput.value, '');
    });
  }


  DOM.obsDateInput.value = new Date().toISOString().split('T')[0];
  initEventListeners();
  renderWeatherPills();
  fetchDBStatus();
  // Account-dependent data is loaded after user-session.js confirms the
  // authenticated user. This prevents the feed from briefly rendering a
  // system/default identity during startup.
  fetchSpecies();
  fetchObservations();
  // Poll while the app is open so a same-bird notification appears as a
  // floating badge/toast without requiring the user to open the bell.
  window.setInterval(checkCommunityNotifications, 5000);
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      fetchObservations();
      fetchSpecies();
      fetchCommunityFeed();
      checkCommunityNotifications();
    }
  });
  document.getElementById('syncBanner')?.addEventListener('click', () => { fetchDBStatus(); DOM.dbModal.classList.add('active'); });
  document.getElementById('viewAllBtn')?.addEventListener('click', () => document.querySelector('.nav-btn[data-tab="records"]')?.click());
});
