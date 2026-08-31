# Ontario Top 6 Admission Calculator

A web application designed for Ontario high school students to calculate their Top 6 Grade 12 (4U/4M) university admission averages based on specific program prerequisites.

[![Live Demo](https://outop6.vercel.app)

---

## Features

* **OUInfo Dataset Integration:** Loads prereq requirements and historical target cutoffs across Ontario university programs.
* **Smart Course Selection:** Prioritizes required 4U/4M courses.
* **Early Admission Toggle:** Allows early admission option by including 3U/3M prerequisites.
* **Policy Compliance:** Enforces the 2-course maximum limit for Grade 12 'M' level courses.
* **URL & Local Persistence:** Exports course configurations and program selections directly into a shareable URL.

---

## Tech Stack

* **Frontend:** HTML5, CSS3, Vanilla JavaScript (ES6+)
* **Data Pipeline:** Python (Playwright)
* **Hosting:** Vercel

---

## Project Structure

```text
.
├── data/
│   └── programs.json   # Structured Ontario program dataset
├── js/
│   └── app.js          # Calculation engine, UI state, DOM handler
├── favicon.ico         # Site icon
├── index.html          # Main HTML entry point
└── README.md           # Project documentation
