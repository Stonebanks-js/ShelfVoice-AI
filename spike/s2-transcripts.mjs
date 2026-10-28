// Ten owner setup transcripts for spike S2, written the way counter speech
// comes out: Hinglish, English, Devanagari, fillers and a spoken correction.
// `neverSpoken` lists values the owner didn't say; the model must return null
// for them (doc 01 story 1, doc 02 guardrails).
export const transcripts = [
  {
    id: "t01-hinglish-basic",
    text: "Mera dukaan ka naam Sharma Kirana Store hai, subah saat baje se raat das baje tak khula rehta hai. Maggi chaudah rupaye, Parle-G das rupaye, Aashirvaad atta paanch kilo do sau paintalis rupaye, aur Amul butter sau gram.",
    neverSpoken: ["shop.phone", "shop.address", "product:Amul butter.price_rupees"],
  },
  {
    id: "t02-english-full",
    text: "This is Gupta General Store in Shastri Nagar, Meerut. We open at 8 in the morning and close at 9 at night, Sunday closed. Phone number is 98765 43210. Tata salt one kg 28 rupees, Fortune sunflower oil one litre 165, Surf Excel one kg 140.",
    neverSpoken: [],
  },
  {
    id: "t03-mixed-short",
    text: "Naam hai Balaji Provision. Timing nine to nine. Colgate 100 gram 55 rupaye, Lux sabun 35, Dettol handwash 99, Vim bar 10 rupaye.",
    neverSpoken: ["shop.phone", "shop.address"],
  },
  {
    id: "t04-devanagari",
    text: "मेरी दुकान का नाम श्याम जनरल स्टोर है। सुबह आठ बजे से रात दस बजे तक। चीनी एक किलो पैंतालीस रुपये, अरहर दाल एक किलो एक सौ चालीस रुपये, और बासमती चावल भी रखते हैं।",
    neverSpoken: ["shop.phone", "shop.address", "product:चावल.price_rupees"],
  },
  {
    id: "t05-address-phone",
    text: "Hello, main Ramesh bol raha hoon, Ramesh Kirana, address hai 12 MG Road, Indore. Mobile 9123456780. Kurkure 20 rupaye, Lays 20, Frooti 10, Thums Up do litre 95.",
    neverSpoken: [],
  },
  {
    id: "t06-no-products",
    text: "Dukaan ka naam Laxmi Stores hai, hum har din subah 7 se dopahar 1 aur shaam 5 se raat 10 tak khulte hain.",
    neverSpoken: ["shop.phone", "shop.address"],
    expectNoProducts: true,
  },
  {
    id: "t07-no-shop-name",
    text: "Doodh Amul Taaza aadha litre 28, dahi 400 gram 40, paneer 200 gram 90, bread 40, anda ek darjan 84.",
    neverSpoken: ["shop.name", "shop.phone", "shop.address", "shop.hours_text"],
  },
  {
    id: "t08-loose-vegetables",
    text: "Pyaaz 40 rupaye kilo, aloo 30 rupaye kilo, tamatar 50 kilo, dhaniya patti 10 rupaye gaddi, nimbu 5 rupaye ka ek. Dukaan ka naam Hari Sabzi Bhandar.",
    neverSpoken: ["shop.phone", "shop.address", "shop.hours_text"],
  },
  {
    id: "t09-fillers",
    text: "Haan toh... umm... Parle-G ka bada packet, wo 50 ka hai, aur chhota wala 5 ka. Hide and Seek 30. Good Day bhi hai, 20 waala aur 10 waala.",
    neverSpoken: ["shop.name", "shop.phone", "shop.address", "shop.hours_text"],
  },
  {
    id: "t10-correction",
    text: "Saini Medical and General Store. Open 10 to 10. Dettol 125 ml 70 rupees, no wait, 75 rupees. Band-Aid pack 40. Vicks 25.",
    neverSpoken: ["shop.phone", "shop.address"],
    expectPrice: { name: "Dettol", price: 75 },
  },
];
