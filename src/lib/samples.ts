import { offsetFromToday } from './dates';

/** Realistic messy campus notices for the quick-try chips. */
export const SAMPLE_NOTICES: { label: string; text: string }[] = [
  {
    label: 'Placement drive TODAY',
    text: `*FWD: Placement cell*\nnovaTech is coming TOMOROW actually TODAY for SDE interns!! 9:30 reporting at Main Auditorium. aptitude 10:30, tech round 1:30, HR 4. final yr CSE/IT only. BRING 2 RESUMES + ID. formal dress. forward to everyone`,
  },
  {
    label: 'Hackathon poster caption',
    text: `HACKAARU 48\n36 hour hackathon, UN SDG themes. Teams of 2-4, prize pool 1 lakh. This ${new Date(Date.now() + 2 * 86400000).toLocaleDateString('en-US', { weekday: 'long' })} 9am onwards, Aryabhatta innovation lab Block C. Free meals + stay. Register at link in bio by tonight!!`,
  },
  {
    label: 'Fee reminder email',
    text: `Subject: Fee reminder: Semester 5\n\nDear student,\nThis is to remind you that the last date to pay the 5th semester tuition fee is TODAY, 5:00 PM on the student portal or at the accounts section (Admin Block). A late fine of ₹1000 per week applies after today.\nRegards,\nAccounts Office`,
  },
  {
    label: 'Cultural fest forward',
    text: `omg everyone SARAS FEST is HERE\n${offsetFromToday(12).slice(8)} nov main ground\nPronite 5pm, celebrity night 8pm\nwristband 150 only at council desk\ncome come come!!`,
  },
  {
    label: 'Exam room change',
    text: `NOTICE\nMATH 301 mid sem exam — room changed. Now in Seminar Hall 2, Block B. This Friday 10:00 to 12:00. Bring hall ticket. Syllabus units 1-3 only.`,
  },
  {
    label: 'Vague WhatsApp rumour',
    text: `guys someone said hostel mess menu changed from monday?? and food timings moved?? idk confirm pls. Also water tank cleaning tuesday 10am-2pm no water those hours`,
  },
];
