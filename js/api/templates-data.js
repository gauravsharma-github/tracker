// Preloaded template library ("Add Exam/Project").
// Each outline is an indented list: top level = subjects, then units, then topics.
// The same parser (js/core/outline.js) reads outlines pasted from ChatGPT / Gemini.
// In production this list would come from the backend (GET /templates?category=&q=).
(function (TI) {
  TI.templates = [
    // ---------------------------------------------------------------- Exams
    { id: 'neet-pg', cat: 'exam', name: 'NEET PG', desc: 'National Eligibility-cum-Entrance Test (Postgraduate)', outline: `
Pre-clinical
  Anatomy
  Physiology
  Biochemistry
Para-clinical
  Pathology
  Pharmacology
  Microbiology
  Forensic Medicine
  Community Medicine (PSM)
Clinical
  General Medicine
  General Surgery
  Obstetrics & Gynaecology
  Paediatrics
  Ophthalmology
  ENT
  Orthopaedics
  Dermatology
  Psychiatry
  Anaesthesiology
  Radiology` },
    { id: 'jee-main', cat: 'exam', name: 'JEE Main', desc: 'Joint Entrance Examination Main (Engineering)', outline: `
Physics
  Units and Measurements
  Kinematics
  Laws of Motion
  Work, Energy and Power
  Rotational Motion
  Gravitation
  Properties of Solids and Liquids
  Thermodynamics
  Kinetic Theory of Gases
  Oscillations and Waves
  Electrostatics
  Current Electricity
  Magnetic Effects of Current and Magnetism
  Electromagnetic Induction and AC
  Electromagnetic Waves
  Optics
  Dual Nature of Matter and Radiation
  Atoms and Nuclei
  Electronic Devices
Chemistry
  Physical Chemistry
    Some Basic Concepts in Chemistry
    Atomic Structure
    Chemical Bonding
    Chemical Thermodynamics
    Solutions
    Equilibrium
    Redox Reactions and Electrochemistry
    Chemical Kinetics
  Inorganic Chemistry
    Classification of Elements and Periodicity
    p-Block Elements
    d- and f-Block Elements
    Coordination Compounds
  Organic Chemistry
    Purification and Characterisation
    Basic Principles of Organic Chemistry
    Hydrocarbons
    Organic Compounds Containing Halogens
    Organic Compounds Containing Oxygen
    Organic Compounds Containing Nitrogen
    Biomolecules
Mathematics
  Sets, Relations and Functions
  Complex Numbers and Quadratic Equations
  Matrices and Determinants
  Permutations and Combinations
  Binomial Theorem
  Sequence and Series
  Limits, Continuity and Differentiability
  Integral Calculus
  Differential Equations
  Coordinate Geometry
  Three Dimensional Geometry
  Vector Algebra
  Statistics and Probability
  Trigonometry` },
    { id: 'neet-ug', cat: 'exam', name: 'NEET UG', desc: 'National Eligibility-cum-Entrance Test (Undergraduate)', outline: `
Physics
  Physics and Measurement
  Kinematics
  Laws of Motion
  Work, Energy and Power
  Rotational Motion
  Gravitation
  Properties of Solids and Liquids
  Thermodynamics
  Oscillations and Waves
  Electrostatics
  Current Electricity
  Magnetic Effects of Current
  Electromagnetic Induction
  Optics
  Dual Nature of Matter
  Atoms and Nuclei
  Electronic Devices
Chemistry
  Some Basic Concepts
  Atomic Structure
  Chemical Bonding
  Thermodynamics
  Equilibrium
  Redox and Electrochemistry
  Chemical Kinetics
  p-, d- and f-Block Elements
  Coordination Compounds
  Hydrocarbons
  Haloalkanes and Haloarenes
  Alcohols, Phenols and Ethers
  Aldehydes, Ketones and Carboxylic Acids
  Amines
  Biomolecules
Biology
  Diversity in Living World
  Structural Organisation in Plants and Animals
  Cell Structure and Function
  Plant Physiology
  Human Physiology
  Reproduction
  Genetics and Evolution
  Biology and Human Welfare
  Biotechnology
  Ecology and Environment` },
    { id: 'ca-inter', cat: 'exam', name: 'CA Intermediate', desc: 'Institute of Chartered Accountants of India Exam', outline: `
Group I
  Advanced Accounting
  Corporate and Other Laws
  Taxation
    Income Tax
    Goods and Services Tax
Group II
  Cost and Management Accounting
  Auditing and Ethics
  Financial Management and Strategic Management
    Financial Management
    Strategic Management` },
    { id: 'upsc-cse', cat: 'exam', name: 'UPSC CSE', desc: 'UPSC Civil Services Examination', outline: `
Prelims – GS Paper I
  History of India and Indian National Movement
  Indian and World Geography
  Indian Polity and Governance
  Economic and Social Development
  Environmental Ecology and Climate Change
  General Science
  Current Events
Prelims – CSAT
  Comprehension
  Logical Reasoning and Analytical Ability
  Decision Making and Problem Solving
  Basic Numeracy
  Data Interpretation
Mains – GS I
  Indian Heritage and Culture
  Modern Indian History
  World History
  Indian Society
  Geography of the World and India
Mains – GS II
  Constitution and Polity
  Governance
  Social Justice
  International Relations
Mains – GS III
  Indian Economy
  Agriculture
  Science and Technology
  Environment
  Disaster Management
  Internal Security
Mains – GS IV
  Ethics and Human Interface
  Attitude and Aptitude
  Emotional Intelligence
  Public Service Values
  Case Studies
Essay
  Essay Practice` },
    { id: 'ssc-cgl', cat: 'exam', name: 'SSC CGL', desc: 'Staff Selection Commission Combined Graduate Level', outline: `
Quantitative Aptitude
  Number System
  Algebra
  Geometry
  Trigonometry
  Mensuration
  Statistics
General Intelligence and Reasoning
  Analogies
  Classification
  Coding-Decoding
  Series
  Blood Relations
  Syllogism
English Comprehension
  Grammar
  Vocabulary
  Reading Comprehension
  Cloze Test
General Awareness
  History
  Geography
  Polity
  Economics
  General Science
  Current Affairs` },
    { id: 'ca-foundation', cat: 'exam', name: 'CA Foundation', desc: 'Entry-level exam of the CA course (ICAI)', outline: `
Accounting
  Theoretical Framework
  Accounting Process
  Bank Reconciliation Statement
  Inventories
  Depreciation
  Final Accounts
  Partnership Accounts
Business Laws
  Indian Contract Act
  Sale of Goods Act
  Partnership Act
  LLP Act
  Companies Act
Quantitative Aptitude
  Ratio and Proportion
  Equations
  Time Value of Money
  Permutations and Combinations
  Sequence and Series
  Statistics
  Probability
Business Economics
  Theory of Demand and Supply
  Theory of Production and Cost
  Price Determination in Markets
  Business Cycles` },
    { id: 'cat', cat: 'exam', name: 'CAT', desc: 'Common Admission Test (IIM MBA entrance)', outline: `
Verbal Ability and Reading Comprehension
  Reading Comprehension
  Para Jumbles
  Para Summary
  Odd Sentence Out
Data Interpretation and Logical Reasoning
  Tables and Charts
  Caselets
  Arrangements
  Games and Tournaments
  Venn Diagrams
Quantitative Ability
  Arithmetic
  Algebra
  Geometry and Mensuration
  Number System
  Modern Maths` },
    { id: 'gate-cse', cat: 'exam', name: 'GATE CSE', desc: 'Graduate Aptitude Test in Engineering – Computer Science', outline: `
General Aptitude
  Verbal Aptitude
  Quantitative Aptitude
  Analytical Aptitude
  Spatial Aptitude
Engineering Mathematics
  Discrete Mathematics
  Linear Algebra
  Calculus
  Probability and Statistics
Core Subjects
  Digital Logic
  Computer Organization and Architecture
  Programming and Data Structures
  Algorithms
  Theory of Computation
  Compiler Design
  Operating System
  Databases
  Computer Networks` },
    { id: 'gre', cat: 'exam', name: 'GRE', desc: 'Graduate Record Examination', outline: `
Verbal Reasoning
  Reading Comprehension
  Text Completion
  Sentence Equivalence
  Vocabulary
Quantitative Reasoning
  Arithmetic
  Algebra
  Geometry
  Data Analysis
Analytical Writing
  Analyze an Issue` },
    { id: 'gmat', cat: 'exam', name: 'GMAT', desc: 'Graduate Management Admission Test (Focus Edition)', outline: `
Quantitative Reasoning
  Arithmetic
  Algebra
  Word Problems
Verbal Reasoning
  Reading Comprehension
  Critical Reasoning
Data Insights
  Data Sufficiency
  Multi-Source Reasoning
  Table Analysis
  Graphics Interpretation
  Two-Part Analysis` },
    { id: 'clat', cat: 'exam', name: 'CLAT', desc: 'Common Law Admission Test', outline: `
English Language
  Reading Comprehension
  Vocabulary and Grammar
Current Affairs and General Knowledge
  National and International Affairs
  Legal Current Affairs
Legal Reasoning
  Law of Contracts
  Law of Torts
  Criminal Law
  Constitutional Law
Logical Reasoning
  Arguments
  Assumptions and Inferences
  Analogies
Quantitative Techniques
  Ratio and Proportion
  Percentages
  Data Interpretation` },
    { id: 'ugc-net', cat: 'exam', name: 'UGC NET (Paper 1)', desc: 'National Eligibility Test – Teaching and Research Aptitude', outline: `
Paper 1
  Teaching Aptitude
  Research Aptitude
  Comprehension
  Communication
  Mathematical Reasoning and Aptitude
  Logical Reasoning
  Data Interpretation
  Information and Communication Technology
  People, Development and Environment
  Higher Education System` },
    { id: 'cbse-10', cat: 'exam', name: 'Class 10 · CBSE', desc: 'CBSE Class 10 board exam (NCERT)', outline: `
English
  First Flight
  Footprints Without Feet
  Grammar
  Writing Skills
Mathematics
  NCERT - Mathematics
    Chapter 1: Real Numbers
    Chapter 2: Polynomials
    Chapter 3: Pair of Linear Equations
    Chapter 4: Quadratic Equations
    Chapter 5: Arithmetic Progressions
    Chapter 6: Triangles
    Chapter 7: Coordinate Geometry
    Chapter 8: Trigonometry
    Chapter 9: Applications of Trigonometry
    Chapter 10: Circles
    Chapter 11: Areas Related to Circles
    Chapter 12: Surface Areas and Volumes
    Chapter 13: Statistics
    Chapter 14: Probability
Science
  Chemical Reactions and Equations
  Acids, Bases and Salts
  Metals and Non-metals
  Carbon and its Compounds
  Life Processes
  Control and Coordination
  How do Organisms Reproduce?
  Heredity
  Light
  The Human Eye
  Electricity
  Magnetic Effects of Electric Current
  Our Environment
Social Science
  History
  Geography
  Political Science
  Economics` },

    // ---------------------------------------------------------- Programming
    { id: 'devops', cat: 'programming', name: 'DevOps', desc: 'Roadmap to DevOps Engineering', outline: `
Foundations
  Linux Basics
  Shell Scripting
  Networking Fundamentals
  Git and GitHub
Containers
  Docker
  Container Registries
  Kubernetes
  Helm
CI/CD
  GitHub Actions
  Jenkins
  ArgoCD
Infrastructure as Code
  Terraform
  Ansible
Cloud
  AWS Core Services
  IAM and Security
Observability
  Prometheus
  Grafana
  Logging (ELK / Loki)` },
    { id: 'dsa', cat: 'programming', name: 'Data Structures & Algorithms', desc: 'Interview-ready DSA roadmap', outline: `
Basics
  Time and Space Complexity
  Recursion
  Bit Manipulation
Linear Structures
  Arrays
  Strings
  Linked Lists
  Stacks
  Queues
  Hashing
Searching and Sorting
  Binary Search
  Two Pointers
  Sliding Window
  Sorting Algorithms
Trees
  Binary Trees
  Binary Search Trees
  Heaps
  Tries
Graphs
  BFS and DFS
  Shortest Paths
  Minimum Spanning Tree
  Topological Sort
  Union Find
Advanced
  Greedy
  Backtracking
  Dynamic Programming
  Segment Trees` },
    { id: 'system-design', cat: 'programming', name: 'System Design', desc: 'Concepts and case studies for design interviews', outline: `
Fundamentals
  Scalability and Load Balancing
  Caching
  Databases: SQL vs NoSQL
  Replication and Sharding
  CAP Theorem and Consistency
  Message Queues
  API Design (REST, gRPC)
  Rate Limiting
Case Studies
  URL Shortener
  Chat System
  News Feed
  Video Streaming
  Ride Sharing
  Distributed Cache` },
    { id: 'react', cat: 'programming', name: 'React', desc: 'Front-end roadmap with React', outline: `
JavaScript Refresher
  ES6+ Syntax
  Async / Await and Promises
  Modules
React Core
  JSX and Components
  Props and State
  Hooks
  Context
  Forms
Ecosystem
  React Router
  Data Fetching (TanStack Query)
  State Management
  Styling
  Testing
Shipping
  Performance
  Accessibility
  Deployment` },
    { id: 'python', cat: 'programming', name: 'Python', desc: 'Python from basics to advanced', outline: `
Basics
  Syntax and Variables
  Data Types
  Control Flow
  Functions
  Modules and Packages
Data Structures
  Lists, Tuples, Sets
  Dictionaries
  Comprehensions
Intermediate
  OOP
  Exceptions
  File I/O
  Iterators and Generators
  Decorators
Advanced
  Concurrency (threads, asyncio)
  Type Hints
  Testing with pytest
  Packaging` },
    { id: 'java-backend', cat: 'programming', name: 'Java Back-end', desc: 'Java and Spring Boot back-end roadmap', outline: `
Java
  Core Java
  Collections
  Streams and Lambdas
  Concurrency
Spring
  Spring Core
  Spring Boot
  Spring Data JPA
  Spring Security
  Testing
APIs and Data
  REST API Design
  SQL and PostgreSQL
  Caching with Redis
  Messaging with Kafka
Delivery
  Docker
  CI/CD
  Observability` },
    { id: 'ai-engineering', cat: 'programming', name: 'AI Engineering', desc: 'Building applications with LLMs', outline: `
Foundations
  How LLMs Work
  Tokens and Context Windows
  Prompt Engineering
Building
  Calling Model APIs
  Structured Outputs
  Tool Use and Agents
  Retrieval-Augmented Generation
  Embeddings and Vector Databases
Quality
  Evaluation
  Guardrails and Safety
  Cost and Latency
Shipping
  Fine-tuning Basics
  Deployment and Monitoring` },

    // -------------------------------------------------------------- Medical
    { id: 'anatomy', cat: 'medical', name: 'Anatomy', desc: 'First-year MBBS anatomy', outline: `
General Anatomy
  Introduction and Terminology
  Bones and Joints
  Muscles
Upper Limb
  Pectoral Region
  Axilla
  Arm and Forearm
  Hand
Lower Limb
  Gluteal Region
  Thigh
  Leg and Foot
Thorax
  Thoracic Wall
  Heart
  Lungs
Abdomen and Pelvis
  Abdominal Wall
  GI Tract
  Pelvis and Perineum
Head and Neck
  Scalp and Face
  Neck
  Cranial Cavity
Neuroanatomy
  Spinal Cord
  Brainstem
  Cerebrum
Embryology and Histology
  General Embryology
  General Histology` },
    { id: 'general-medicine', cat: 'medical', name: 'General Medicine', desc: 'Specialisation roadmap – Internal Medicine', outline: `
Cardiology
  Heart Failure
  Ischaemic Heart Disease
  Arrhythmias
  Valvular Disease
Respiratory
  Asthma and COPD
  Pneumonia
  Tuberculosis
Gastroenterology
  Liver Disease
  GI Bleeding
  IBD
Nephrology
  AKI and CKD
  Electrolytes
Endocrinology
  Diabetes
  Thyroid
Neurology
  Stroke
  Epilepsy
Infectious Disease
  Fever and Sepsis
  HIV
Haematology
  Anaemia
  Leukaemia and Lymphoma` },
    { id: 'radiology', cat: 'medical', name: 'Radiology', desc: 'Specialisation roadmap – Radiodiagnosis', outline: `
Physics and Safety
  Radiation Physics
  Radiation Protection
  MRI Physics
Chest
  Chest X-ray Interpretation
  CT Chest
Abdomen
  Ultrasound Abdomen
  CT Abdomen
Neuro
  CT Head
  MRI Brain
Musculoskeletal
  Fractures
  Bone Tumours
Paediatric and Obstetric
  Obstetric Ultrasound
  Paediatric Imaging` },
    { id: 'ophthalmology', cat: 'medical', name: 'Ophthalmology', desc: 'Specialisation roadmap – Eye', outline: `
Basics
  Anatomy of the Eye
  Optics and Refraction
Anterior Segment
  Conjunctiva and Cornea
  Lens and Cataract
  Glaucoma
  Uvea
Posterior Segment
  Retina
  Diabetic Retinopathy
  Neuro-ophthalmology
Others
  Squint
  Orbit and Oculoplasty
  Community Ophthalmology` },
  ];
})(window.TI);
