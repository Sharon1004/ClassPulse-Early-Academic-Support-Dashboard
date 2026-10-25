# ClassPulse

### Early Academic Support Dashboard

> **Every learner, noticed early.**

ClassPulse is an **explainable early-warning dashboard for teachers**. It brings attendance and assessment trends together, identifies students who may need support, and shows **exactly why they were flagged** — so the teacher always decides what happens next.

Built for **Innovators Conclave 2026 — IC26-02-02 Software Challenge** by **B. Sharon Preethi, P. Poojadevi, and T. Priyanjali**.

> **Responsible demo:** All student data included with the project is synthetic. Do not upload real student information without appropriate consent and a secured deployment.

---

## Why ClassPulse?

A learner rarely begins struggling all at once.

Attendance may start falling.

Assessment scores may gradually decline.

A learner's performance may move away from their usual baseline.

But these signals often live in separate records and become obvious only after several assessments.

ClassPulse brings those signals together so teachers can notice meaningful changes earlier.

```text
Attendance ───────┐
                  │
Assessments ──────┼──► EXPLAINABLE SIGNAL ──► TEACHER REVIEW ──► SUPPORT
                  │
Past Trends ──────┘
```

> **ClassPulse suggests who to look at and why. The teacher decides what happens next.**

---

# What It Does

| Area | What it does |
|---|---|
| **Dashboard** | KPIs, "needs attention first" list with sparklines, class risk split, trend charts and a visual **Pulse Grid** showing every student × every week. |
| **Explainable Alerts** | Uses four transparent rules: low attendance, attendance drop, low scores and score decline. Every alert shows the observed value and threshold. |
| **Threshold Simulator** | Change a threshold and preview how many students would move between levels before saving it. Admins save; teachers can explore. |
| **PulsePath Plans** | Create support plans from student alerts, assign actions, record follow-ups and complete or cancel plans. |
| **Support Impact** | Compares attendance and scores before and after support begins while honestly displaying **"awaiting data"** when there is not enough evidence yet. |
| **Assignments & Tests** | Teachers publish work, review submissions, grade assessments and control when marks are released. |
| **Student Portal** | Students can access their own work and released marks without seeing teacher-only information. |
| **CSV Import** | Drag-and-drop importing with strict validation, line-numbered errors and merge/replace options. |
| **Role-Based Access** | Separate Admin, Teacher and Student capabilities. |
| **Accessibility** | Keyboard navigation, screen-reader support and responsive layouts down to mobile devices. |
| **Productivity** | Command palette with **Ctrl/⌘ + K**, light/dark themes and shareable student URLs. |

---

# The ClassPulse Experience

ClassPulse is designed around one simple journey:

```text
       SIGNAL
          ↓
       REVIEW
          ↓
       SUPPORT
          ↓
      FOLLOW-UP
          ↓
       OUTCOME
```

We call this **PulsePath**.

Rather than stopping after identifying a potentially struggling learner, ClassPulse helps teachers move from detection to documented support.

---

# Academic Pulse

ClassPulse does not rely on an unexplained AI prediction.

Instead, it builds an **Academic Pulse** from observable academic signals.

```text
       ATTENDANCE
            ●
           ╱ ╲
          ╱   ╲
         ╱     ╲
        ●───────●
 ASSESSMENTS   TREND
        ╲       ╱
         ╲     ╱
          ╲   ╱
           ▼ ▼
       CLASS PULSE
            │
            ▼
     TEACHER REVIEW
```

This allows teachers to understand **what changed**, rather than simply seeing a label.

---

# Explainable Alerts

ClassPulse currently evaluates four transparent rules.

### 01 — Low Attendance

Average attendance over the latest **4 weeks** falls below the configured minimum.

### 02 — Attendance Drop

Attendance during the latest **3 weeks** is compared with the previous three weeks.

A sufficient decline triggers an alert.

### 03 — Low Scores

The average of the latest **2 assessments** falls below the configured minimum score.

### 04 — Score Decline

The latest **2 assessments** are compared with the previous two.

A sufficient decline triggers an alert.

Every alert exposes:

```text
RULE
  ↓
OBSERVED VALUE
  ↓
THRESHOLD
  ↓
EXPLANATION
```

There is no hidden model deciding why a learner was flagged.

---

# Risk Interpretation

Alerts are classified according to how far the observed result moves beyond the configured threshold.

A **high alert** occurs when the signal is:

- 10+ points beyond the threshold, or
- a decline of at least 2× the configured drop threshold.

For dashboard prioritisation:

- Medium alert → **20 risk points**
- High alert → **35 risk points**
- Maximum → **100**

Risk level becomes:

**High** → any high alert OR 3+ alerts

**Medium** → 1–2 alerts

The score helps organize the dashboard.

It does **not** make decisions about the learner.

> **Rule-based. Explainable. Teacher-controlled.**

---

# Pulse Grid

One of ClassPulse's key visualizations is the **Pulse Grid**.

Instead of making teachers inspect dozens of attendance records individually, the Pulse Grid represents:

```text
                WEEK
           1  2  3  4  5  6 ...

Student A  ●  ●  ●  ●  ●  ●
Student B  ●  ●  ◐  ◐  ●  ●
Student C  ●  ◐  ◐  ●  ●  ●
Student D  ●  ●  ●  ●  ●  ●
              ↑
        emerging pattern
```

Each cell represents a student's weekly attendance relative to the configured threshold.

This turns a spreadsheet-like dataset into a visual classroom pulse where emerging patterns are easier to notice.

---

# Threshold Simulator

Academic support rules should not be mysterious.

ClassPulse therefore includes a **Threshold Simulator**.

Teachers can explore what happens when thresholds change before those settings are applied.

```text
Attendance threshold

80% ─────────●────────── 100%
             85%

          SIMULATE
              ↓

      HIGH     MEDIUM     LOW
        9        14        13
```

The simulator previews how many learners would move between levels.

Teachers can explore.

Authorized admins decide what gets saved.

---

# PulsePath Support Plans

A warning without action has limited value.

PulsePath connects an academic signal with a support workflow.

```text
SIGNAL
  │
  ▼
Teacher reviews explanation
  │
  ▼
Create support plan
  │
  ├── Action 1 ✓
  ├── Action 2 ✓
  └── Action 3 ○
  │
  ▼
Follow-up
  │
  ▼
Observe subsequent data
```

Plans can be prefilled using the learner's active alerts.

Teachers can:

- create support plans
- record actions
- complete individual actions
- log follow-ups
- complete plans
- cancel plans when appropriate

The objective is not simply to identify students.

It is to help teachers move from **signal → support**.

---

# Impact Intelligence

The Impact section answers a more useful question than:

**"How many students were flagged?"**

It asks:

> **What happened after support began?**

ClassPulse compares relevant student data from **before and after a support plan starts**.

### Attendance Impact

```text
BEFORE SUPPORT                  AFTER SUPPORT

78% ────────────────►           84%
                               +6 pts
```

### Assessment Impact

```text
BEFORE SUPPORT                  AFTER SUPPORT

62% ────────────────►           69%
                               +7 pts
```

These comparisons help teachers explore whether performance changed after support began.

They do **not** claim that ClassPulse caused the change.

> **Impact figures show association, not proof of causation.**

---

## Honest Impact States

ClassPulse does not manufacture an improvement percentage when sufficient data does not exist.

If a support plan has recently started and no meaningful post-plan records exist, the dashboard displays:

> **Awaiting data**

instead of presenting a misleading result.

This is an intentional responsible-design choice.

---

# From Detection to Impact

The full ClassPulse data story becomes:

```text
ACADEMIC DATA
     │
     ▼
┌─────────────┐
│   SIGNAL    │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ EXPLANATION │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   TEACHER   │
│   REVIEW    │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  PULSEPATH  │
│   SUPPORT   │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  FOLLOW-UP  │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   IMPACT    │
└─────────────┘
```

This makes ClassPulse more than an alert dashboard.

It creates a traceable path from **academic signal to teacher-led support and follow-up**.

---

# Responsible by Design

ClassPulse is designed as a **decision-support system**, not an automated decision-maker.

### Explainability

Every alert can be traced to an understandable rule and threshold.

### Human in the Loop

Teachers decide whether a signal requires action.

### No Automated High-Stakes Decisions

ClassPulse does not automatically punish, grade, group or make academic decisions about students.

### Honest Uncertainty

When there is insufficient information to measure post-support change, ClassPulse reports **"awaiting data."**

### Synthetic Demo Data

The repository ships with synthetic records rather than real student information.

### Role-Based Access

Users only receive functionality appropriate to their role.

> **Signals are prompts, not verdicts.**

---

# Roles

### Admin

Administrators have access to the complete administrative functionality, including saved system thresholds and data management.

### Teacher

Teachers can:

- review students
- inspect explainable alerts
- explore thresholds
- manage PulsePath plans
- create assessments
- review submissions
- grade work
- control mark release

Teacher access to settings is read-only where appropriate.

### Student

Students can access only their own student-facing information, including assigned work and released marks.

---

# Assignments & Assessments

ClassPulse also connects academic monitoring with everyday classroom assessment.

Teachers can:

```text
CREATE WORK
     ↓
PUBLISH
     ↓
STUDENT SUBMISSION
     ↓
TEACHER REVIEW
     ↓
GRADE
     ↓
RELEASE MARKS
```

Teachers remain in control of when results become visible to students.

---

# CSV Import

ClassPulse supports structured CSV importing.

Example:

```csv
name,class,week,attendance_pct,score_pct
Asha Example,9-A,1,96,80
Asha Example,9-A,2,94,
```

Each row represents one student for one week.

`score_pct` may be empty.

Students are matched using:

```text
Student Name + Class
```

The entire file is validated before anything is imported.

Errors include line numbers so invalid records can be corrected quickly.

Try:

```text
sample-data/sample_import.csv
```

---

# Run Locally

## Requirements

Use **Node.js 20 LTS**.

Node.js **18.11+** is also supported.

From the project folder:

```bash
npm run setup
```

This installs root, server and client dependencies.

Create the server environment file.

### Windows

```cmd
copy .env.example server\.env
```

### macOS / Linux

```bash
cp .env.example server/.env
```

Then start ClassPulse:

```bash
npm run dev
```

### Local URLs

API:

```text
http://localhost:5000
```

Application:

```text
http://localhost:5173
```

---

# Demo Accounts

For a local demonstration:

```text
Admin
admin@classpulse.demo

Teacher
teacher@classpulse.demo

Student
student@classpulse.demo
```

The password is the value of:

```text
DEMO_PASSWORD
```

If it is empty during local development, the default local-only password is:

```text
ClassPulse@2026
```

The project creates synthetic demonstration data on first start.

Current seed data includes:

- **36 synthetic students**
- **12 weeks of data**
- **6 support plans**

Admins can restore the demonstration dataset from **Settings & Data**.

---

# Testing

Run the API integration checks with:

```bash
npm test
```

The test suite contains **24 integration checks** covering areas including:

- authentication
- roles
- alerts
- plans
- impact
- CSV handling
- threshold simulation

---

# Production Build

Build the React application:

```bash
npm run build
```

The production frontend is generated in:

```text
client/dist
```

Start the production application using:

```bash
npm start
```

Set:

```text
NODE_ENV=production
```

before starting a production deployment.

---

# Deployment

ClassPulse is designed so the Express server can serve both:

1. the API
2. the production React application

This means the complete application can run through a single web service.

## MongoDB Atlas

For persistent cloud data, create a MongoDB Atlas cluster and provide:

```text
MONGODB_URI
```

If MongoDB is unavailable, the application can use its local file-backed demo storage for development and short demonstrations.

Local file data is not appropriate as persistent storage on hosts whose filesystems reset.

---

## Render

The repository includes:

```text
render.yaml
```

for deployment using a Render Blueprint.

Required production environment configuration includes:

```text
NODE_ENV=production
JWT_SECRET=<secure-random-secret>
DEMO_PASSWORD=<strong-demo-password>
MONGODB_URI=<mongodb-connection-string>
```

`MONGODB_URI` is optional when intentionally using the local fallback storage.

The project also contains a:

```text
Dockerfile
```

for deployment on compatible container hosting platforms.

---

# Project Architecture

```text
ClassPulse
│
├── package.json
│   └── setup / dev / build / start / test
│
├── render.yaml
├── Dockerfile
├── .env.example
│
├── sample-data/
│   └── sample_import.csv
│
├── server/
│   ├── index.js
│   ├── store.js
│   ├── alerts.js
│   ├── csv.js
│   ├── seed.js
│   └── test.js
│
└── client/
    ├── src/
    │   ├── App.jsx
    │   ├── styles.css
    │   │
    │   └── components/
    │       ├── Dashboard
    │       ├── Students
    │       ├── StudentProfile
    │       ├── PulsePath
    │       ├── Impact
    │       ├── Assessments
    │       ├── StudentDashboard
    │       ├── Settings
    │       ├── Login
    │       ├── UI
    │       └── Icons
    │
    └── dist/
```

---

# Technology Stack

### Frontend

- React
- Vite
- Responsive CSS
- Custom dashboard visualizations

### Backend

- Node.js
- Express.js

### Database

- MongoDB
- MongoDB Atlas for persistent cloud deployments
- Local JSON/file-backed fallback for development/demo use

### Engineering

- REST APIs
- JWT-based authentication
- Role-based authorization
- CSV validation
- Automated API integration tests
- Docker deployment support
- GitHub Actions CI
- Responsive and accessible UI

---

# Security Notes

In production, ClassPulse refuses to start without appropriately configured security values.

Production requires:

```text
JWT_SECRET
DEMO_PASSWORD
```

Sessions expire after **8 hours**.

Login attempts are rate-limited.

Sensitive files such as:

```text
.env
node_modules
server/data
```

are excluded from Git.

---

# Known Limitations

ClassPulse is currently a hackathon prototype.

Known limitations include:

- Demo accounts currently share one configured password.
- A real deployment requires individual user accounts and password-reset functionality.
- Login rate limiting is currently stored in memory and resets when the server restarts.
- Teachers currently have access to all students rather than class-specific teacher assignments.
- Support impact shows association and should not be interpreted as proof that an intervention caused an academic improvement.
- Cloud persistence depends on the configured MongoDB Atlas deployment.
- Real student data requires appropriate privacy, security and consent processes.

---

# Demo Flow for Judges

A short demonstration can tell the complete ClassPulse story.

### 1. Dashboard

Start with the classroom overview and **Needs Attention First**.

### 2. Pulse Grid

Show how emerging attendance patterns become visible across weeks.

### 3. Student Profile

Open a flagged learner and show exactly which rules triggered.

### 4. Threshold Simulator

Change a threshold and demonstrate how the system previews the effect before saving.

### 5. PulsePath

Turn the signal into a support plan and demonstrate actions/follow-up.

### 6. Impact Intelligence

Show before-vs-after information for existing plans and demonstrate the honest **Awaiting Data** state.

### 7. Student Portal

Switch roles to demonstrate what the student can and cannot access.

The complete story becomes:

> **Detect → Explain → Review → Support → Follow up → Measure**

---

# Why ClassPulse Is Different

Many systems answer:

> **"Which student is high risk?"**

ClassPulse is designed to answer:

> **"What changed, why was it flagged, and what should the teacher review?"**

Its differentiation is not a more mysterious algorithm.

It is the combination of:

**Explainable signals**

+

**Teacher-controlled thresholds**

+

**Visual academic patterns**

+

**Structured support plans**

+

**Follow-up impact**

+

**Role-aware access**

---

# Innovators Conclave 2026

**Challenge:** IC26-02-02 — Software Challenge

### Team

**B. Sharon Preethi**  
Team Lead


**T. Priyanjali**  
Team Member

**P. Poojadevi**  
Team Member


---

# Our Principle

Technology should help teachers **notice**, not decide for them.

ClassPulse does not replace teacher judgement.

It gives teachers a clearer view of patterns already present in their academic data and provides a structured way to respond.

> ### **Spot the signal before the struggle.**

## ClassPulse

**Explainable signals. Teacher-led decisions. Earlier support.**

### **Every learner, noticed early.**
