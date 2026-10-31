import type { CampusItem } from './types';
import { offsetFromToday, weekdayShort, dayMonth, addDays } from './dates';

/**
 * Seed notices — written the way they actually arrive: forwarded, messy,
 * all over the place. Dates are computed relative to TODAY so the app
 * always opens with a live-looking campus.
 */
export function buildSeedItems(): CampusItem[] {
  const d = offsetFromToday;
  const today = d(0);
  const tomorrow = d(1);
  const mk = (
    id: string,
    partial: Omit<CampusItem, 'id' | 'checkedActions' | 'source' | 'engine' | 'createdAt' | 'done'> & { done?: boolean },
  ): CampusItem => ({
    id,
    checkedActions: [],
    done: false,
    source: 'seed',
    engine: 'seed',
    createdAt: new Date().toISOString(),
    ...partial,
  });

  return [
    mk('seed-placement-nova', {
      title: 'NovaTech placement drive — final year',
      date: today,
      time: '09:30',
      endTime: '17:00',
      venue: 'Main Auditorium, Block A',
      category: 'Placement',
      priority: 'critical',
      kind: 'deadline',
      summary:
        'NovaTech Solutions is visiting campus for the software engineer role (18–24 LPA). Rounds: aptitude test (10:30), technical interview (1:30), HR (4:00). Final-year CSE/IT students only.',
      actionItems: [
        'Report to Main Auditorium by 9:30 AM with ID card',
        'Carry 2 printed copies of your resume',
        'Formal dress code — no exceptions',
      ],
      rawText: `*FWD: Placement cell*
NovaTech Solutions will be visiting campus TOMORROW?? no TODAY for the SDE role... wait it's pinned for today itself. Reporting 9:30 at Main Auditorium. Aptitude 10:30, tech round 1:30, HR 4:00. Final year only. Bring 2 resumes and college ID. Formal dress mandatory.`,
    }),
    mk('seed-fee-deadline', {
      title: 'Semester fee — last date to pay',
      date: today,
      time: '17:00',
      endTime: null,
      venue: 'Accounts Section, Admin Block',
      category: 'Fee',
      priority: 'critical',
      kind: 'deadline',
      summary:
        'Last day to pay the 5th semester tuition fee without late fine. Pay online via the student portal or at the accounts section before 5 PM. Late payment attracts ₹1,000 fine per week.',
      actionItems: [
        'Pay ₹38,500 on the student portal before 5:00 PM',
        'Download and keep the fee receipt for records',
      ],
      rawText: `Reminder: Today is the LAST DATE for 5th sem tuition fee payment. Portal closes 5 PM sharp. Late fee ₹1000/week applies after today. Accounts section open till 6.`,
    }),
    mk('seed-nit-fest', {
      title: 'Nrityotsav — Battle of the Bands',
      date: today,
      time: '18:30',
      endTime: '22:00',
      venue: 'Open Air Theatre (OAT)',
      category: 'Event',
      priority: 'high',
      kind: 'event',
      summary:
        'Inter-college Battle of the Bands featuring 8 colleges, live tonight at the OAT. Entry free with student ID. Gates open 6 PM, show starts 6:30. Food stalls by culinary club.',
      actionItems: ['Carry college ID for entry'],
      rawText: `NRITYOTSAV NIGHT 2
Battle of the Bands TONIGHT at the Open Air Theatre!! 8 colleges battling it out. Free entry with ID. Gates 6 PM, first chord 6:30 sharp. See you there!!`,
    }),
    mk('seed-hackathon', {
      title: 'HackAaru 48 — 36-hour hackathon',
      date: d(2),
      time: '09:00',
      endTime: null,
      venue: 'Aryabhatta Innovation Lab, Block C',
      category: 'Hackathon',
      priority: 'high',
      kind: 'event',
      summary:
        '36-hour hackathon on UN SDG themes. Teams of 2–4, ₹1L prize pool, mentorship from 6 industry mentors. Free meals and stay provided for all registered teams.',
      actionItems: [
        'Register your team on the HackAaru portal by tonight',
        'Carry laptop, charger and student ID',
        'Review the SDG problem statements beforehand',
      ],
      rawText: `HACKAARU 48 
36 hours. One problem. ₹1,00,000 prize pool.
${weekdayShort(d(2))}, ${dayMonth(d(2))} • 9 AM onwards • Aryabhatta Innovation Lab
Teams of 2-4. Mentorship by 6 industry mentors. Free meals + stay. Register now!`,
    }),
    mk('seed-midsem-maths', {
      title: 'MATH 301 — Mid-semester exam',
      date: d(4),
      time: '10:00',
      endTime: '12:00',
      venue: 'See hall ticket for room',
      category: 'Exam',
      priority: 'high',
      kind: 'deadline',
      summary:
        'MATH 301 (Linear Algebra & Complex Analysis) mid-semester exam, 10 AM–12 PM. Syllabus: Units 1–3. Bring hall ticket and college ID. No electronic items allowed.',
      actionItems: [
        'Download hall ticket from the exam cell portal',
        'Carry college ID card',
        'Revise Units 1–3',
      ],
      rawText: `Mid-sem schedule MATH 301 — Linear Algebra
Date: ${weekdayShort(d(4))} ${dayMonth(d(4))}, 10:00 AM to 12:00 PM
Room as per hall ticket. Units 1-3 syllabus. College ID mandatory. Electronic items NOT allowed.`,
    }),
    mk('seed-ai-workshop', {
      title: 'Workshop: Building LLM apps — hands-on',
      date: d(3),
      time: '14:00',
      endTime: '17:00',
      venue: 'Aryabhatta Lab 3, Block C',
      category: 'Academic',
      priority: 'normal',
      kind: 'event',
      summary:
        'Hands-on workshop by the Google Developer Student Club on building production LLM apps with function calling. Laptops required. Limited to 80 seats, first-come first-served.',
      actionItems: ['Bring a laptop with charger', 'Register on the GDSC portal — only 80 seats'],
      rawText: `GDSC presents: Building LLM Apps — Hands-on Workshop
${weekdayShort(d(3))} ${dayMonth(d(3))}, 2 PM to 5 PM, Aryabhatta Lab 3
Bring your laptops! Function calling, structured outputs, everything hands-on. Limited to 80 seats — register on the GDSC portal.`,
    }),
    mk('seed-placement-info', {
      title: 'Info session: FinServ Corp internship PPT',
      date: d(5),
      time: '16:00',
      endTime: '17:00',
      venue: 'AV Room, Central Library',
      category: 'Placement',
      priority: 'normal',
      kind: 'event',
      summary:
        'Pre-placement talk by FinServ Corp for summer 2027 internships (₹40k/month stipend). Open to all pre-final-year students. Attendance counts toward internship eligibility.',
      actionItems: ['Attend with resume', 'Note the PPT for application deadlines'],
      rawText: `FinServ Corp visit — PPT & Internship Info Session
${weekdayShort(d(5))} ${dayMonth(d(5))}, 4 PM, AV Room Central Library
Summer 2027 internships, ₹40k/month. Pre-final year only. Attendance mandatory for application eligibility.`,
    }),
    mk('seed-assignment-dbms', {
      title: 'DBMS assignment 3 submission',
      date: tomorrow,
      time: '23:59',
      endTime: null,
      venue: 'Moodle portal',
      category: 'Academic',
      priority: 'high',
      kind: 'deadline',
      summary:
        'Assignment 3 (normalization + ER modelling) closes tomorrow 11:59 PM on Moodle. Late submissions not accepted — portal locks automatically. Worth 10% of course grade.',
      actionItems: [
        'Complete normalization exercises 3.1–3.6',
        'Submit ER diagram PDF on Moodle before midnight',
      ],
      rawText: `DBMS Assignment 3 closes TOMORROW 11:59 PM sharp. Normalization + ER modeling. PDF upload on Moodle only. Portal locks automatically, no mails will be accepted after the deadline. 10% of grade.`,
    }),
    mk('seed-fest-saras', {
      title: 'Saras Fest — Pronite & cultural night',
      date: d(6),
      time: '17:00',
      endTime: '23:00',
      venue: 'Main Ground',
      category: 'Event',
      priority: 'normal',
      kind: 'event',
      summary:
        'Annual cultural fest Saras — Pronite (street play) at 5 PM, celebrity night at 8 PM on the main ground. Entry with Saras wristband (₹150, student council desk).',
      actionItems: ['Buy Saras wristband from council desk', 'Reach before 4:30 PM — gates crowded after 6'],
      rawText: `SARAS FEST OUT NOW!!! 
Pronite 5 PM main ground, Celebrity Night 8 PM.
${weekdayShort(d(6))} ${dayMonth(d(6))}
Wristband ₹150 at council desk. Reach early!!`,
    }),
    mk('seed-blood-donation', {
      title: 'Blood donation camp — Red Cross',
      date: d(7),
      time: '10:00',
      endTime: '16:00',
      venue: 'Health Centre, Block D',
      category: 'General',
      priority: 'normal',
      kind: 'event',
      summary:
        'Annual blood donation camp with Red Cross. Voluntary; refreshments and donor certificate provided. 18–60 years, weight > 45kg. Motivate your friends!',
      actionItems: ['Come on empty-ish stomach', 'Bring ID'],
      rawText: `Blood Donation Camp — Red Cross Society
${weekdayShort(d(7))} ${dayMonth(d(7))}, 10 AM to 4 PM, Health Centre Block D
Refreshments + certificate for donors. Eligibility: 18-60 yrs, wt > 45 kg. Spread the word!`,
    }),
    mk('seed-scholarship', {
      title: 'National Scholarship — document verification',
      date: addDays(today, -1),
      time: '14:00',
      endTime: '17:00',
      venue: 'NSS Office, Student Centre',
      category: 'Academic',
      priority: 'normal',
      kind: 'deadline',
      summary:
        'Verification of scholarship documents for selected candidates (income certificate, marksheets, bank passbook). Was scheduled yesterday; missed candidates can re-verify Monday.',
      actionItems: ['If you missed it, contact NSS office before Monday'],
      rawText: `National Scholarship verification was held ${dayMonth(addDays(today, -1))} 2-5 PM at NSS Office. Candidates who missed can contact the office before Monday.`,
    }),
    mk('seed-sports-intercollege', {
      title: 'Inter-college football finals',
      date: d(8),
      time: '16:00',
      endTime: '18:30',
      venue: 'Football Ground, Sports Complex',
      category: 'Sports',
      priority: 'normal',
      kind: 'event',
      summary: 'Campus vs Stella Maris Institute — inter-college football final, 4 PM at the sports complex ground. Come cheer the team, free entry.',
      actionItems: [],
      rawText: `FOOTBALL FINALS Campus vs Stella Maris! ${weekdayShort(d(8))} ${dayMonth(d(8))}, 4 PM sharp, Sports Complex. Bring your lungs. #CampusPride`,
    }),
    mk('seed-library-fine', {
      title: 'Library fine amnesty week ends',
      date: d(9),
      time: '18:00',
      endTime: null,
      venue: 'Central Library, Ground Floor',
      category: 'Fee',
      priority: 'high',
      kind: 'deadline',
      summary:
        'Last day of library fine amnesty week — return overdue books with waived fines (up to ₹300). After today fines double and add to your exam block.',
      actionItems: ['Return overdue books', 'Collect amnesty receipt'],
      rawText: `Library fine AMNESTY WEEK ends ${weekdayShort(d(9))} ${dayMonth(d(9))}. Overdue fines waived up to ₹300. After today, fines double. Exam block applies.`,
    }),
    mk('seed-placement-deadline-white', {
      title: 'Wipro off-campus registration closes',
      date: d(11),
      time: '23:59',
      endTime: null,
      venue: 'Online — placement portal',
      category: 'Placement',
      priority: 'high',
      kind: 'deadline',
      summary:
        'Wipro Turbo off-campus hiring for 2027 batch — registration closes in 11 days. Eligible: 60%+ in 10th/12th/degree. One attempt at the online assessment.',
      actionItems: ['Register on placement portal', 'Keep 10th/12th marksheets ready'],
      rawText: `Wipro off-campus registration CLOSING ${dayMonth(d(11))}!! Eligible batch 2027, 60% throughout. Register via placement portal. One attempt OA.`,
    }),
    mk('seed-old-notice', {
      title: 'End-semester exam form submission',
      date: addDays(today, -12),
      time: '17:00',
      endTime: null,
      venue: 'Exam cell',
      category: 'Exam',
      priority: 'high',
      kind: 'deadline',
      summary: 'End-semester exam form deadline (closed). Extra fees applied after this date.',
      actionItems: [],
      done: true,
      rawText: `End-sem exam form last date was ${dayMonth(addDays(today, -12))}. Closed.`,
    }),
  ];
}
