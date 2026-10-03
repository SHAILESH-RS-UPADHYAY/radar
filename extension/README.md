# RADAR · Auto-Fill

One click in RADAR opens a job's application form **already filled**: your details, every question answered (written
answers, Yes/No buttons, dropdowns, search-and-pick boxes like Location) and your resume PDF. You review it and press
the employer's Submit. RADAR logs the application.

```text
RADAR card  ↯ ONE-CLICK APPLY
   │  the form opens in a new tab at once
   ▼
form tab    ~1 s   your facts + PDF filled (name, email, phone, links, location, sponsorship, EEO): no AI needed
   │        then   RADAR's written answers arrive (drafted, then HUMANIZED) and fill in
   │        and    questions RADAR could not read ahead are read in the tab, answered by RADAR, filled
   │  RADAR://FILL panel: PREPARING → ANSWERING → READY · NEEDS YOU lists anything left
   ▼
you         check it, press Submit
   │  the employer confirms (or you press ✓ I SUBMITTED IT)
   ▼
RADAR       C2 · OPS: applied, with the resume that went out
```

## Install (2 minutes)

1. Chrome → `chrome://extensions` → switch on **Developer mode** (top right).
2. **Load unpacked** → pick this `extension/` folder.
3. Open RADAR (or reload it). **Settings → Application Kit** shows `EXTENSION://RADAR-AUTO-FILL · CONNECTED`, and the
   cards in DISCOVERY and THE VAULT show **↯ ONE-CLICK APPLY**.
4. Upload your resume once in **Settings → RESUME** in this browser: RADAR keeps the PDF here (never on its server) and
   attaches it whenever a job has no OVERCLOCK-tailored resume. The Kit shows `RESUME PDF IN THIS BROWSER`.

After changing a file here: `chrome://extensions` → RADAR · Auto-Fill → ⟳ reload, then reload the RADAR tab. Keep the
RADAR dashboard tab open while forms fill: it answers the questions the form tabs read.

## What it will and will not do

| Does                                                                                  | Never                                                                               |
| ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| fills text, dropdowns (also React selects), search-and-pick boxes, radios, checkboxes | presses Submit, Next or Apply                                                       |
| presses Yes/No buttons, with the form's submission blocked while it does              | touches a CAPTCHA                                                                   |
| reads the questions RADAR could not read ahead, and gets each one its own answer      | runs in a tab RADAR did not open                                                    |
| attaches your resume PDF (tailored, else the one kept in this browser)                | fills LinkedIn or Indeed (their terms forbid automation)                            |
| keeps whatever is already in a field                                                  | fills a newsletter or search box: only the application form itself                  |
| waits for a form that opens late (an Apply button, a modal), up to 10 minutes         | sends anything anywhere: answers go from RADAR to your page                         |
| fills a form embedded in a frame, and each step of a multi-step form                  | logs an application the employer did not confirm, unless you press ✓ I SUBMITTED IT |
| lists the required questions still empty, with a jump to each                         |                                                                                     |

## Where it works

| Form                                                       | How                                                                                                                                       |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Greenhouse (also boards that redirect to their own site)   | opened on Greenhouse's embed form; RADAR reads every question ahead and answers it by its field name                                      |
| Lever                                                      | opened on `/apply`; custom questions by their card ids                                                                                    |
| Ashby                                                      | opened on `/application`; its questions (Yes/No buttons, Location, custom text) are read in the tab and answered. Checked live on Cohere  |
| any other page (Workable, SmartRecruiters, company sites…) | your facts by label, then every question on the page read in the tab and answered                                                         |
| YC startups                                                | their jobs come through their ATS above. Work at a Startup's own form needs your YC login: open it, press its Apply, the note is answered |

Accounts (Workday, iCIMS sign-ups), CAPTCHAs, legal consents (agreements, arbitration) and questions your materials
cannot answer stay with you; the panel lists them.

## Files

| File              | Role                                                                                                                        |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `manifest.json`   | Manifest V3; permissions below                                                                                              |
| `background.js`   | service worker: opens the form tab, merges its answers as they arrive (session memory), injects `fill.js` into it           |
| `radar-bridge.js` | runs only on RADAR's own pages; relays between the page (`window.postMessage`) and the worker                               |
| `fill.js`         | in the form tab: reads every question, fills it, asks RADAR about the unknown ones, the panel, watches for the confirmation |
| `icons/`          | the radar mark, 16–128 px                                                                                                   |

The page side is `src/lib/extension.ts` (`useExtension`, `launchInExtension`, `armInExtension`, `onExtension`) and
`src/lib/apply/client.ts` (`oneClickApply`, `answerPageQuestions`, the resume PDF kept in the browser). Answers come
from `POST /api/apply/prepare` (`draft: false` for the instant facts; `fields` for questions read in the tab).

### Messages

| From → to         | Message                                         | Meaning                                                                  |
| ----------------- | ----------------------------------------------- | ------------------------------------------------------------------------ |
| RADAR → worker    | `launch {url, matchId, tailoredId, packet?}`    | open the form now (answers follow)                                       |
| RADAR → worker    | `arm {matchId, packet}`                         | answers for that tab, added to what it has (facts first, the AI's later) |
| RADAR → worker    | `arm {matchId, more: {id, packet or error}}`    | the answers to the questions the tab asked                               |
| RADAR → worker    | `arm {matchId, error}`                          | why there are no answers (before any) or a note (after some)             |
| form tab → worker | `packet`                                        | "what do I have?": the merged answers, their version, `more`, the state  |
| form tab → worker | `questions {id, fields}`                        | questions RADAR has not seen, relayed to the RADAR tab                   |
| form tab → worker | `filled {filled, needs, lines, labels}`         | relayed to RADAR, and to the page's panel from a frame                   |
| form tab → worker | `armed` · `submitted`                           | you pressed Submit · the employer confirmed it                           |
| worker → RADAR    | `launched` · `filled` · `questions` · `applied` | toasts; answer the questions; log the application                        |

## Permissions, and why

| Permission                    | Why                                                                                         |
| ----------------------------- | ------------------------------------------------------------------------------------------- |
| `storage`                     | `chrome.storage.session`: the open form tabs and their answers, in memory only              |
| `scripting` + `webNavigation` | put `fill.js` into the tab RADAR opened, after each page load and into its form frames      |
| host access `<all_urls>`      | an application form can be on any company's site; the worker still only enters RADAR's tabs |

## Privacy

Answers and the PDF travel from your RADAR tab to the form tab inside your browser. They are held in session memory
(gone when the browser closes, or when that tab closes) and never sent to a server by the extension. Questions read on
a form go to RADAR (your own account) to be answered, like the forms RADAR reads itself.

## Test

`chrome://extensions` → load it, open RADAR, press ↯ ONE-CLICK APPLY on a Greenhouse, Lever or Ashby job and do
**not** submit: the panel should reach READY with the PDF attached, every question answered and Submit marked. A tab
you open yourself shows no panel.
