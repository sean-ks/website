// Everything the terminal can ls and cat: a string is a text file, an object a folder, { link } a binary file that open launches, { generated: 'novig' } the Novig stats.
window.SITE = {
  user: 'guest',
  host: 'sean',
  home: '/home/guest',

  fetch: [
    ['Name', 'Sean Shiroma'],
    ['Role', 'Software Engineer'],
    ['Location', 'New York'],
    ['School', 'Stony Brook University'],
    ['Studying', 'Computer Science and Math'],
  ],

  fs: {
    'about-me.txt':
`Software engineer based in New York. Studying Computer Science and Math at Stony Brook University.

My work spans full-stack development, trading systems, machine learning, cryptography, systems programming, distributed systems, and storage systems.

Looking for a broad range of technical work, reach out to seanks2004@gmail.com.
`,

    'contact-me.txt':
`email     sean@lbtrading.com
github    https://github.com/sean-ks
linkedin  https://linkedin.com/in/seanshiroma
`,

    'education.txt':
`Stony Brook University
B.S. with Honors in Computer Science
B.S. in Applied Mathematics and Statistics

GPA  3.94 / 4.0

Coursework
- Graduate Operating Systems
- Graduate Computer Architecture
- Cloud Computing
- Computer Networks
- Software Development
- Theory of Computation (Honors)
- Analysis of Algorithms (Honors)
- Probability Theory
- Data Structures and Algorithms
`,

    'skills.txt':
`languages   C, C++, Java, Python, Go, SQL, JavaScript/TypeScript, Bash, OCaml
frameworks  Spring (Boot, Batch), Django, Node.js, Next.js, FastAPI, gRPC, Kafka, Flink, OpenTelemetry, PyTorch, NumPy
databases   PostgreSQL, Oracle, Snowflake, ScyllaDB, MongoDB, Redis, SQLite, InfluxDB, VictoriaMetrics
cloud       AWS, GCP, Docker, Kubernetes, OpenShift, Nginx, Jenkins, Prometheus, Grafana
tools       Git, Linux, GDB, QEMU, CUDA, k6, pm2
`,

    'novig-stats.txt': { generated: 'novig' },

    'resume.pdf': { link: 'resume_sean_shiroma.pdf' },

    'picture.jpeg': { link: 'picture.jpeg', image: 'Photo of Sean Shiroma' },

    experience: {
      'lbtrading.txt':
`Lukacsy-Bhowmik Trading
Member / Quant Developer / Software Engineer · Stony Brook, NY
Sep 2026 – present

- Market making on Novig: https://www.lbtrading.com/stats/novig
- Currently researching and testing strategies.
- Used Python, Redis, pm2, EC2.

Trading stats: cat ~/novig-stats.txt
`,

      'citi.txt':
`Citi
Technology Application Development Intern · New York, NY
Jun 2026 – Aug 2026

- Worked on the observability platform for Citi's exchange-traded derivatives clearing system (post-trading system), processing 2 million trades a day.
- Used Java, Kafka, Flink, OpenTelemetry, Prometheus, Grafana, OpenShift/K8s.
`,

      'src.txt':
`SRC Inc.
Software Engineer Intern · Syracuse, NY (remote)
Feb 2026 – May 2026

- Worked on a performance monitoring platform.
- Used Python, C++, InfluxDB.
`,

      'fsl.txt':
`File Systems & Storage Lab, Stony Brook University
Research Fellow · Stony Brook, NY
Aug 2025 – present

- Researched and worked on a distributed key management system for century-scale archival data.
- Currently working on Approximate SNARKs for Verifiable ML.
- Used Python, C++, gRPC, SQLite, MP-SPDZ.
`,

      'broadridge.txt':
`Broadridge Financial Solutions
Software Engineer Intern · New York, NY
Jun 2025 – Aug 2025

- Implemented and integrated a disaster recovery database for a major bank's financial data platform.
- Used Java, Oracle 19c, Spring, Snowflake.
`,
    },

    projects: {
      'polymarket-weather-trading.txt':
`Polymarket Weather Trading
Jun 2026 – present

- Built a system that trades weather markets on Polymarket using my own machine learning model based on the transformer architecture.
- Used Python, PyTorch, NumPy, CUDA.
`,

      'riscv-kernel.txt':
`RISC-V Kernel
Jan 2026 – May 2026

- Built a non-trivial RISC-V operating system modeled on Linux and FreeBSD for my graduate operating systems class.
- Used C, QEMU, GDB, RISC-V toolchain.
`,

      'discord-clone.txt':
`Discord Clone
Mar 2026 – May 2026

- Created a Discord clone for a cloud computing class that handled 5k concurrent users and 500 msgs/s, and wrote the Go backend that handles messages.
- Used Python, Go, ScyllaDB, Postgres, Django, Redis, Docker, Nginx, k6, VictoriaMetrics.
`,

      'seawolf-accessibility.txt':
`Seawolf Accessibility
Winter 2025
https://github.com/tarunvaid05/Seawolf-Accessibility

- Wrote an accessible campus navigation website for a hackathon, and wrote the C code that parses OpenStreetMap graph data to compute shortest paths.
- Learned a lot and made a lot of mistakes :(
- Used Python, C, Next.js, FastAPI, NumPy, Google Maps API.
`,
    },

    '.bashrc':
`#
# ~/.bashrc
#

# If not running interactively, don't do anything
[[ $- != *i* ]] && return

alias ls='ls --color=auto'
alias grep='grep --color=auto'
PS1='[\\u@\\h \\W]\\$ '
`,

    '.bash_profile':
`#
# ~/.bash_profile
#

[[ -f ~/.bashrc ]] && . ~/.bashrc
`,
  },
};
