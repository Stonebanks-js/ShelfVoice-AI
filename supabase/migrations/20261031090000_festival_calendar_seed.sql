-- W-19 (FR-12, doc 07 K6): the festivals that move kirana stock, November
-- 2026 to December 2027, so forecasts rise in the 7 days before each one.
--
-- Dates checked Oct 31, 2026 against:
--   DoPT O.M. F.No.12/2/2023-JCA of 3 July 2025 (2026 list): Diwali 8 Nov 2026.
--   DoPT O.M. F.No.12/2/2023-JCA of 16 July 2026 (2027 gazetted list):
--     Id-ul-Fitr 10 Mar, Holi 23 Mar, Ram Navami 15 Apr, Id-ul-Zuha 17 May,
--     Janmashtami 25 Aug, Dussehra 9 Oct, Diwali 29 Oct, Christmas 25 Dec.
--   Drik Panchang festival calendar for New Delhi (drikpanchang.com):
--     Dhanteras 6 Nov 2026, Govardhan Puja 10 Nov, Bhai Dooj 11 Nov,
--     Chhath 15 Nov 2026; Lohri 14 Jan 2027, Makar Sankranti 15 Jan;
--     Holika Dahan 21 Mar, Holi 22 Mar; Chaitra Navratri 7 Apr;
--     Raksha Bandhan 17 Aug; Ganesh Chaturthi 4 Sep; Shardiya Navratri
--     30 Sep; Dhanteras 27 Oct, Bhai Dooj 31 Oct; Chhath 4 Nov 2027.
--
-- Windows: the whole festival (Dhanteras to Bhai Dooj; Nahay Khay, two days
-- before the Chhath date, to the dawn offering a day after); a day either
-- side of the Eid and Bakrid dates, which follow the moon sighting; both
-- Holi dates; the eve as well for Christmas, Raksha Bandhan, Janmashtami
-- and Ganesh Chaturthi (a day either side for the last, a ten-day festival
-- whose first days sell most).
--
-- Factors are configuration values (doc 02 p12), set here by hand: 1.5 for
-- Diwali across the shop, 1.4 for Holi and Eid-ul-Fitr on what they're
-- cooked and served with, 1.2 to 1.3 for the rest. Categories match the
-- names the app suggests (Snacks, Dairy, Staples, Atta and rice, ...),
-- compared without case; an empty list means every product.

alter table public.product_forecasts add column festival text check (char_length(festival) <= 80);

insert into public.festival_calendar (name, starts_on, ends_on, factor, categories) values
  ('Diwali',               '2026-11-06', '2026-11-11', 1.5, '{}'),
  ('Chhath',               '2026-11-13', '2026-11-16', 1.3, '{Staples,Atta and rice,Dairy}'),
  ('Christmas',            '2026-12-24', '2026-12-25', 1.2, '{Bakery,Beverages,Snacks}'),
  ('Lohri and Sankranti',  '2027-01-14', '2027-01-15', 1.3, '{Staples,Snacks}'),
  ('Eid',                  '2027-03-09', '2027-03-11', 1.4, '{Staples,Dairy,Bakery}'),
  ('Holi',                 '2027-03-21', '2027-03-23', 1.4, '{Snacks,Beverages,Dairy,Staples}'),
  ('Navratri',             '2027-04-07', '2027-04-15', 1.2, '{Staples,Dairy}'),
  ('Bakrid',               '2027-05-16', '2027-05-18', 1.3, '{Staples,Dairy}'),
  ('Raksha Bandhan',       '2027-08-16', '2027-08-17', 1.3, '{Snacks,Biscuits,Dairy}'),
  ('Janmashtami',          '2027-08-24', '2027-08-25', 1.3, '{Dairy,Staples}'),
  ('Ganesh Chaturthi',     '2027-09-03', '2027-09-05', 1.2, '{Dairy,Staples}'),
  ('Navratri and Dussehra','2027-09-30', '2027-10-09', 1.3, '{Staples,Dairy}'),
  ('Diwali',               '2027-10-27', '2027-10-31', 1.5, '{}'),
  ('Chhath',               '2027-11-02', '2027-11-05', 1.3, '{Staples,Atta and rice,Dairy}'),
  ('Christmas',            '2027-12-24', '2027-12-25', 1.2, '{Bakery,Beverages,Snacks}');
