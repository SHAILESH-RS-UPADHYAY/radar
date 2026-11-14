import type { MatchedJob } from '@/components/dashboard/types';

/** A made-up match, drawn with the real Discovery card wherever the site previews one (home page, look screen). */
export const SAMPLE: MatchedJob = {
  id: 'sample',
  score: 91,
  reasoning:
    'Title matches Software Engineer. Matches 5/6 listed skills. Missing: kubernetes. Strong resume-JD alignment. Remote',
  matching_skills: ['python', 'typescript', 'llm', 'rag', 'react'],
  missing_skills: ['kubernetes'],
  section: 'dream',
  status: 'new',
  auto_saved: false,
  status_changed_at: null,
  first_seen_at: null,
  stage: null,
  stage_changed_at: null,
  applied_at: null,
  notes: null,
  resume_version_id: null,
  last_event: null,
  job: {
    id: 'sample',
    title: 'Software Engineer, AI Platform',
    location: 'Remote · India',
    work_type: 'remote',
    skills: [],
    apply_url: '/sign-up',
    form_url: '/sign-up',
    department: 'Engineering',
    posted_at: null,
    is_active: true,
    experience_required: '1-3',
    salary_min: null,
    salary_max: null,
    salary_currency: null,
    company: { name: 'Northwind AI', source: null, category: 'Growth' },
  },
};
