export const COMPULSORY_OLEVEL_SUBJECTS = [
  "English",
  "Mathematics",
  "Chemistry",
  "Biology",
  "Physics",
  "History",
  "Geography"
] as const;

export const OTHER_OLEVEL_SUBJECTS = [
  "Agriculture",
  "Entrepreneurship",
  "Luganda",
  "Fine Art",
  "Kiswahili",
  "Physical Education",
  "CRE",
  "Literature"
] as const;

export const ALL_OLEVEL_SUBJECTS = [
  ...COMPULSORY_OLEVEL_SUBJECTS,
  ...OTHER_OLEVEL_SUBJECTS
] as const;

