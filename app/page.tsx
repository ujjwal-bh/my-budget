"use client";

import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { getSupabaseBrowser } from "@/lib/supabase-browser";
import { bsMonthEnd, bsMonthStart, currentBsMonth, formatBsDate, formatBsMonth, isInBsMonth, nepaliMonths, previousBsMonth } from "@/lib/nepali-date";
import { ArrowDownRight, ArrowUpRight, BarChart3, CreditCard, LayoutDashboard, Menu, Pencil, Plus, Target, Trash2, Wallet, X } from "lucide-react";
import "./dashboard.css";

const supabase = getSupabaseBrowser();

type Transaction = { id: number; merchant: string; category: string; date: string; amount: number; type: "expense" | "income" };
type Budget = { id: number; category: string; monthly_limit: number; month: string };
type Category = { id: number; name: string };
type Page = "Overview" | "Transactions" | "Reports" | "Spending goal" | "Categories" | "Settings";
const navItems: { label: Page; icon: typeof LayoutDashboard }[] = [
  { label: "Overview", icon: LayoutDashboard }, { label: "Transactions", icon: CreditCard }, { label: "Reports", icon: BarChart3 }, { label: "Spending goal", icon: Target }, { label: "Categories", icon: Wallet }, { label: "Settings", icon: Target },
];
const currency = (value: number) => `NPR ${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const monthName = formatBsMonth;

export default function Home() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [page, setPage] = useState<Page>("Overview");
  const [mobileNav, setMobileNav] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(currentBsMonth());
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [merchant, setMerchant] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [type, setType] = useState<"expense" | "income">("expense");
  const [newCategory, setNewCategory] = useState("");
  const [goal, setGoal] = useState("");
  const [profileName, setProfileName] = useState("");
  const [savingTransaction, setSavingTransaction] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true); });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession));
    return () => listener.subscription.unsubscribe();
  }, []);

  const loadData = async (currentSession: Session) => {
    const headers = { Authorization: `Bearer ${currentSession.access_token}` };
    const [transactionResponse, categoryResponse, budgetResponse] = await Promise.all([
      fetch("/api/transactions", { headers }),
      supabase.from("categories").select("id, name").eq("user_id", currentSession.user.id).order("name"),
      supabase.from("budgets").select("id, category, monthly_limit, month").eq("user_id", currentSession.user.id).order("created_at", { ascending: false }),
    ]);
    if (transactionResponse.ok) setTransactions(await transactionResponse.json());
    setCategories((categoryResponse.data as Category[]) ?? []);
    setBudgets((budgetResponse.data as Budget[]) ?? []);
  };

  useEffect(() => { if (session) { void loadData(session); setProfileName(session.user.user_metadata.full_name ?? ""); } }, [session]);

  const monthTransactions = useMemo(() => transactions.filter((transaction) => isInBsMonth(transaction.date, selectedMonth)), [transactions, selectedMonth]);
  const spent = useMemo(() => monthTransactions.filter((transaction) => transaction.type === "expense").reduce((sum, transaction) => sum + Number(transaction.amount), 0), [monthTransactions]);
  const income = useMemo(() => monthTransactions.filter((transaction) => transaction.type === "income").reduce((sum, transaction) => sum + Number(transaction.amount), 0), [monthTransactions]);
  const priorMonth = previousBsMonth(selectedMonth);
  const previousSpent = transactions.filter((transaction) => transaction.type === "expense" && isInBsMonth(transaction.date, priorMonth)).reduce((sum, transaction) => sum + Number(transaction.amount), 0);
  const difference = previousSpent ? ((spent - previousSpent) / previousSpent) * 100 : 0;
  const spendingGoal = budgets.find((budget) => budget.category === "Overall spending" && isInBsMonth(budget.month, selectedMonth));
  const goalProgress = spendingGoal ? Math.min((spent / Number(spendingGoal.monthly_limit)) * 100, 100) : 0;

  function openCreate() { setEditing(null); setMerchant(""); setAmount(""); setCategory(categories[0]?.name ?? "Other"); setType("expense"); setShowForm(true); }
  function openEdit(transaction: Transaction) { setEditing(transaction); setMerchant(transaction.merchant); setAmount(String(transaction.amount)); setCategory(transaction.category); setType(transaction.type); setShowForm(true); }

  async function saveTransaction(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session || !merchant || !amount || !category || savingTransaction) return;
    setSavingTransaction(true);
    try {
      const payload = { merchant, amount: Number(amount), category, type };
      const response = await fetch(editing ? `/api/transactions/${editing.id}` : "/api/transactions", { method: editing ? "PUT" : "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify(payload) });
      if (!response.ok) return;
      const saved = await response.json() as Transaction;
      setTransactions((current) => editing ? current.map((transaction) => transaction.id === saved.id ? saved : transaction) : [saved, ...current]);
      setShowForm(false);
    } finally { setSavingTransaction(false); }
  }

  async function deleteTransaction(id: number) {
    if (!session) return;
    const response = await fetch(`/api/transactions/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${session.access_token}` } });
    if (response.ok) setTransactions((current) => current.filter((transaction) => transaction.id !== id));
  }

  async function addCategory(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session || !newCategory.trim()) return;
    const { data } = await supabase.from("categories").insert({ user_id: session.user.id, name: newCategory.trim() } as never).select("id, name").single();
    if (data) { setCategories((current) => [...current, data as Category].sort((a, b) => a.name.localeCompare(b.name))); setNewCategory(""); }
  }

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profileName.trim()) return;
    const { data, error } = await supabase.auth.updateUser({ data: { full_name: profileName.trim() } });
    if (!error && data.user) setSession((current) => current ? { ...current, user: data.user } : current);
  }

  async function saveGoal(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session || !goal) return;
    const existing = spendingGoal;
    const payload = { user_id: session.user.id, category: "Overall spending", monthly_limit: Number(goal), month: bsMonthStart(selectedMonth).toISOString() };
    const request = existing ? supabase.from("budgets").update(payload as never).eq("id", existing.id).select("id, category, monthly_limit, month").single() : supabase.from("budgets").insert(payload as never).select("id, category, monthly_limit, month").single();
    const { data } = await request;
    if (data) { setBudgets((current) => existing ? current.map((budget) => budget.id === data.id ? data as Budget : budget) : [data as Budget, ...current]); setGoal(""); }
  }

  if (!ready) return <main className="auth-loading">Loading your workspace…</main>;
  if (!session) return <AuthScreen />;
  const displayName = session.user.user_metadata.full_name ?? session.user.email?.split("@")[0] ?? "there";

  return <main className="app-shell">
    <aside className={`sidebar ${mobileNav ? "sidebar-open" : ""}`}><div className="brand"><span className="brand-mark"><Wallet size={18} /></span><span>pocketwise</span></div><nav className="primary-nav"><span className="nav-label">Workspace</span>{navItems.map(({ label, icon: Icon }) => <button key={label} className={`nav-item ${page === label ? "nav-item-active" : ""}`} onClick={() => { setPage(label); setMobileNav(false); }}><Icon size={18} /><span>{label}</span></button>)}</nav><div className="sidebar-bottom"><button className="sign-out-button" onClick={() => void supabase.auth.signOut()}>Sign out</button></div></aside>
    <section className="content-area"><header className="topbar"><button className="mobile-menu" onClick={() => setMobileNav(true)} aria-label="Open navigation"><Menu size={21} /></button><div className="breadcrumb"><span>Workspace</span><span>/</span><strong>{page}</strong></div><div className="account-actions"><span className="user-avatar small">{displayName.slice(0, 2).toUpperCase()}</span><button className="header-action" onClick={() => setPage("Settings")}>Profile</button><button className="header-action" onClick={() => void supabase.auth.signOut()}>Log out</button></div></header><div className="page-content">
      {page === "Overview" && <Overview displayName={displayName} month={selectedMonth} setMonth={setSelectedMonth} spent={spent} income={income} previousSpent={previousSpent} difference={difference} goal={spendingGoal} progress={goalProgress} transactions={monthTransactions} onAdd={openCreate} onEdit={openEdit} onDelete={deleteTransaction} onViewTransactions={() => setPage("Transactions")} />}
      {page === "Transactions" && <TransactionsPage transactions={transactions} categories={categories} onAdd={openCreate} onEdit={openEdit} onDelete={deleteTransaction} />}
      {page === "Reports" && <ReportsPage transactions={transactions} selectedMonth={selectedMonth} />}
      {page === "Spending goal" && <GoalPage month={selectedMonth} setMonth={setSelectedMonth} spent={spent} goal={spendingGoal} progress={goalProgress} value={goal} setValue={setGoal} onSave={saveGoal} />}
      {page === "Categories" && <CategoriesPage session={session} categories={categories} setCategories={setCategories} value={newCategory} setValue={setNewCategory} onAdd={addCategory} />}
      {page === "Settings" && <SettingsPage email={session.user.email ?? ""} name={profileName} setName={setProfileName} onSave={saveProfile} onSignOut={() => void supabase.auth.signOut()} />}
    </div></section>
    {mobileNav && <button className="mobile-overlay" onClick={() => setMobileNav(false)} aria-label="Close navigation" />}
    {showForm && <TransactionForm saving={savingTransaction} editing={editing} merchant={merchant} amount={amount} category={category} type={type} categories={categories} setMerchant={setMerchant} setAmount={setAmount} setCategory={setCategory} setType={setType} onClose={() => setShowForm(false)} onSubmit={saveTransaction} />}
  </main>;
}

function BsMonthPicker({ value, onChange }: { value: string; onChange: (value: string) => void }) { const year = Number(value.slice(0, 4)); return <span className="bs-month-picker"><select className="month-input" value={year} onChange={(event) => onChange(`${event.target.value}-${value.slice(5)}`)} aria-label="BS year">{[year - 2, year - 1, year, year + 1, year + 2].map((item) => <option key={item} value={item}>{item}</option>)}</select><select className="month-input" value={value.slice(5)} onChange={(event) => onChange(`${year}-${event.target.value}`)} aria-label="BS month">{nepaliMonths.map((item, index) => <option key={item} value={String(index + 1).padStart(2, "0")}>{item}</option>)}</select></span> }
function Overview({ displayName, month, setMonth, spent, income, previousSpent, difference, goal, progress, transactions, onAdd, onEdit, onDelete, onViewTransactions }: { displayName: string; month: string; setMonth: (value: string) => void; spent: number; income: number; previousSpent: number; difference: number; goal?: Budget; progress: number; transactions: Transaction[]; onAdd: () => void; onEdit: (transaction: Transaction) => void; onDelete: (id: number) => void; onViewTransactions: () => void }) { return <><div className="page-heading"><div><p className="eyebrow">{monthName(month)}</p><h1>Hello, {displayName}</h1><p className="heading-copy">Track your income and keep your spending on course.</p></div><button className="add-button" onClick={onAdd}><Plus size={17} />Add transaction</button></div><div className="filter-row"><label className="date-filter">BS month <BsMonthPicker value={month} onChange={setMonth} /></label></div><div className="stats-grid"><StatCard label="Income" value={currency(income)} detail="for this month" icon={<ArrowDownRight size={18} />} /><StatCard label="Spent" value={currency(spent)} detail={previousSpent ? `${Math.abs(difference).toFixed(1)}% ${difference > 0 ? "more" : "less"} than last month` : "no prior-month data"} icon={<ArrowUpRight size={18} />} /><StatCard label="Available" value={currency(income - spent)} detail="income minus expenses" icon={<Wallet size={18} />} /><StatCard label="Spending goal" value={goal ? currency(Number(goal.monthly_limit)) : "Not set"} detail={goal ? `${progress.toFixed(0)}% used` : "set a monthly limit"} icon={<Target size={18} />} /></div><div className="main-grid"><section className="panel"><div className="panel-header"><div><h2>Monthly spending</h2><p>{previousSpent ? `${currency(spent)} compared with ${currency(previousSpent)} last month` : "Add transactions to see monthly comparisons."}</p></div></div><div className="comparison-bars"><div><span>This month</span><strong>{currency(spent)}</strong><progress className="comparison-progress current-bar" value={Math.max(4, goal ? progress : 55)} max="100" /></div><div><span>Last month</span><strong>{currency(previousSpent)}</strong><progress className="comparison-progress previous-bar" value={Math.max(4, previousSpent && spent ? Math.min((previousSpent / Math.max(spent, previousSpent)) * 100, 100) : 4)} max="100" /></div></div>{goal && <div className="goal-status"><span>Monthly limit: {currency(Number(goal.monthly_limit))}</span><strong>{progress > 100 ? "Over target" : `${currency(Math.max(Number(goal.monthly_limit) - spent, 0))} remaining`}</strong></div>}</section><section className="panel transactions-panel"><div className="panel-header"><div><h2>Recent transactions</h2><p>Click a transaction to edit it.</p></div><button className="view-all" onClick={onViewTransactions}>View all</button></div><TransactionList transactions={transactions.slice(0, 5)} onEdit={onEdit} onDelete={onDelete} compact /></section></div></> }
function TransactionsPage({ transactions, categories, onAdd, onEdit, onDelete }: { transactions: Transaction[]; categories: Category[]; onAdd: () => void; onEdit: (transaction: Transaction) => void; onDelete: (id: number) => void }) { return <><div className="page-heading"><div><p className="eyebrow">All activity</p><h1>Transactions</h1><p className="heading-copy">Every income and expense is linked to a category.</p></div><button className="add-button" onClick={onAdd}><Plus size={17} />Add transaction</button></div><div className="category-filter"><strong>Categories:</strong>{categories.map((item) => <span key={item.id}>{item.name}</span>)}</div><section className="panel transaction-table"><TransactionList transactions={transactions} onEdit={onEdit} onDelete={onDelete} /></section></> }
function ReportsPage({ transactions, selectedMonth }: { transactions: Transaction[]; selectedMonth: string }) { const year = Number(selectedMonth.slice(0, 4)); const months = Array.from({ length: 12 }, (_, index) => `${year}-${String(index + 1).padStart(2, "0")}`); const maximum = Math.max(...months.map((month) => transactions.filter((t) => t.type === "expense" && isInBsMonth(t.date, month)).reduce((sum, t) => sum + Number(t.amount), 0)), 1); return <><div className="page-heading"><div><p className="eyebrow">{year} summary</p><h1>Spending reports</h1><p className="heading-copy">Compare your spending across months and years.</p></div></div><section className="panel annual-report"><h2>Monthly expenses in {year}</h2><div className="year-bars">{months.map((month) => { const value = transactions.filter((t) => t.type === "expense" && isInBsMonth(t.date, month)).reduce((sum, t) => sum + Number(t.amount), 0); return <div key={month}><strong>{currency(value)}</strong><progress className="annual-bar" value={Math.max(3, (value / maximum) * 100)} max="100" /><span>{nepaliMonths[Number(month.slice(5)) - 1].slice(0, 3)}</span></div>; })}</div></section></> }
function GoalPage({ month, setMonth, spent, goal, progress, value, setValue, onSave }: { month: string; setMonth: (value: string) => void; spent: number; goal?: Budget; progress: number; value: string; setValue: (value: string) => void; onSave: (event: React.FormEvent<HTMLFormElement>) => void }) { return <><div className="page-heading"><div><p className="eyebrow">Spend intentionally</p><h1>Monthly spending goal</h1><p className="heading-copy">Set the most you want to spend each month.</p></div></div><div className="filter-row"><label className="date-filter">BS month <BsMonthPicker value={month} onChange={setMonth} /></label></div><section className="panel goal-panel"><div><p className="eyebrow">{monthName(month)}</p><h2>{goal ? `${currency(spent)} of ${currency(Number(goal.monthly_limit))}` : "No spending limit set"}</h2><div className="goal-progress"><progress className="goal-meter" value={progress} max="100" /><span>{goal ? `${progress.toFixed(0)}% of your limit used` : "Create a limit to track your progress."}</span></div></div><form onSubmit={onSave} className="goal-form"><label>Monthly spending limit<input type="number" min="0" step="0.01" value={value} onChange={(event) => setValue(event.target.value)} placeholder={goal ? String(goal.monthly_limit) : "e.g. 2000"} required /></label><button className="add-button">Save goal</button></form></section></> }
function SettingsPage({ email, name, setName, onSave, onSignOut }: { email: string; name: string; setName: (value: string) => void; onSave: (event: React.FormEvent<HTMLFormElement>) => void; onSignOut: () => void }) { return <><div className="page-heading"><div><p className="eyebrow">Account preferences</p><h1>Profile settings</h1><p className="heading-copy">Update the details used in your Pocketwise workspace.</p></div></div><section className="panel profile-settings"><form onSubmit={onSave}><label>Display name<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" required /></label><label>Email address<input value={email} readOnly /></label><button className="add-button">Save profile</button></form><div className="logout-panel"><div><strong>Sign out</strong><p>End your current Pocketwise session on this device.</p></div><button className="header-action" onClick={onSignOut}>Log out</button></div></section></> }
function CategoriesPage({ session, categories, setCategories, value, setValue, onAdd }: { session: Session; categories: Category[]; setCategories: React.Dispatch<React.SetStateAction<Category[]>>; value: string; setValue: (value: string) => void; onAdd: (event: React.FormEvent<HTMLFormElement>) => void }) { const [editingId, setEditingId] = useState<number | null>(null); const [editingName, setEditingName] = useState(""); async function saveCategory(id: number) { const name = editingName.trim(); if (!name) return; const current = categories.find((item) => item.id === id); if (!current) return; const { data } = await supabase.from("categories").update({ name } as never).eq("id", id).eq("user_id", session.user.id).select("id, name").single(); if (data) { await supabase.from("transactions").update({ category: name } as never).eq("user_id", session.user.id).eq("category", current.name); setCategories((items) => items.map((item) => item.id === id ? data as Category : item).sort((a, b) => a.name.localeCompare(b.name))); setEditingId(null); } } async function removeCategory(item: Category) { await supabase.from("transactions").update({ category: "Other" } as never).eq("user_id", session.user.id).eq("category", item.name); const { error } = await supabase.from("categories").delete().eq("id", item.id).eq("user_id", session.user.id); if (!error) setCategories((items) => items.filter((category) => category.id !== item.id)); } return <><div className="page-heading"><div><p className="eyebrow">Organize transaction labels</p><h1>Categories</h1><p className="heading-copy">Rename or remove categories used by your transactions.</p></div></div><form className="panel category-form" onSubmit={onAdd}><label>New category<input value={value} onChange={(event) => setValue(event.target.value)} placeholder="e.g. Groceries" required /></label><button className="add-button">Add category</button></form><section className="panel category-list">{categories.length ? categories.map((item) => <div className="category-row" key={item.id}>{editingId === item.id ? <><input className="category-edit-input" value={editingName} onChange={(event) => setEditingName(event.target.value)} autoFocus /><button className="row-action" onClick={() => void saveCategory(item.id)}>Save</button><button className="row-action" onClick={() => setEditingId(null)}>Cancel</button></> : <><span>{item.name}</span><button className="row-action" onClick={() => { setEditingId(item.id); setEditingName(item.name); }} aria-label={`Edit ${item.name}`}><Pencil size={15} /></button><button className="row-action delete-action" onClick={() => void removeCategory(item)} aria-label={`Delete ${item.name}`}><Trash2 size={15} /></button></>}</div>) : <p>No categories yet. Add one to use it in transactions.</p>}</section></> }
function TransactionList({ transactions, onEdit, onDelete, compact = false }: { transactions: Transaction[]; onEdit: (transaction: Transaction) => void; onDelete: (id: number) => void; compact?: boolean }) { return <div className={compact ? "transaction-list" : "transaction-list full-list"}>{transactions.length ? transactions.map((transaction) => <div className="transaction-row" key={transaction.id}><span className="merchant-icon">{transaction.merchant.charAt(0).toUpperCase()}</span><button className="transaction-info transaction-edit" onClick={() => onEdit(transaction)}><strong>{transaction.merchant}</strong><small>{transaction.category} · {formatBsDate(transaction.date)}</small></button><span className={`transaction-amount ${transaction.type === "income" ? "income" : ""}`}>{transaction.type === "income" ? "+" : "−"}{currency(Number(transaction.amount))}</span><button className="row-action" onClick={() => onEdit(transaction)} aria-label={`Edit ${transaction.merchant}`}><Pencil size={15} /></button><button className="row-action delete-action" onClick={() => void onDelete(transaction.id)} aria-label={`Delete ${transaction.merchant}`}><Trash2 size={15} /></button></div>) : <p className="empty-state">No transactions recorded.</p>}</div> }
function TransactionForm({ saving, editing, merchant, amount, category, type, categories, setMerchant, setAmount, setCategory, setType, onClose, onSubmit }: { saving: boolean; editing: Transaction | null; merchant: string; amount: string; category: string; type: "expense" | "income"; categories: Category[]; setMerchant: (value: string) => void; setAmount: (value: string) => void; setCategory: (value: string) => void; setType: (value: "expense" | "income") => void; onClose: () => void; onSubmit: (event: React.FormEvent<HTMLFormElement>) => void }) { return <div className="modal-backdrop" onClick={onClose}><form className="modal" onSubmit={onSubmit} onClick={(event) => event.stopPropagation()}><div className="modal-heading"><div><p className="eyebrow">{editing ? "Update transaction" : "New transaction"}</p><h2>{editing ? "Edit transaction" : "Add a transaction"}</h2></div><button type="button" className="close-button" onClick={onClose} disabled={saving}><X size={18} /></button></div><div className="transaction-type-toggle"><button type="button" className={type === "expense" ? "toggle-active" : ""} onClick={() => setType("expense")}>Expense</button><button type="button" className={type === "income" ? "toggle-active" : ""} onClick={() => setType("income")}>Income</button></div><label>Merchant<input value={merchant} onChange={(event) => setMerchant(event.target.value)} required autoFocus /></label><label>Amount<input value={amount} onChange={(event) => setAmount(event.target.value)} type="number" min="0" step="0.01" required /></label><label>Category<select value={category} onChange={(event) => setCategory(event.target.value)} required><option value="Other">Other</option>{categories.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}</select></label><button className="add-button full-width" disabled={saving}>{saving ? "Saving…" : editing ? "Save changes" : "Save transaction"}</button></form></div> }
function StatCard({ label, value, detail, icon }: { label: string; value: string; detail: string; icon: React.ReactNode }) { return <div className="stat-card"><div className="stat-top"><span className="stat-icon">{icon}</span></div><p>{label}</p><strong>{value}</strong><small>{detail}</small></div> }
function AuthScreen() { const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in"); const [fullName, setFullName] = useState(""); const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [error, setError] = useState(""); const [message, setMessage] = useState(""); const [submitting, setSubmitting] = useState(false); async function submit(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); if (submitting) return; setSubmitting(true); setError(""); setMessage(""); const result = mode === "sign-in" ? await supabase.auth.signInWithPassword({ email, password }) : await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName.trim() } } }); if (result.error) setError(result.error.message); else if (mode === "sign-up") setMessage("Account created. Check your email to confirm your address."); setSubmitting(false); } return <main className="auth-shell"><section className="auth-card"><div className="brand auth-brand"><span className="brand-mark"><Wallet size={18} /></span><span>pocketwise</span></div><p className="eyebrow">Your money, in focus</p><h1>{mode === "sign-in" ? "Welcome back" : "Create your account"}</h1><p className="auth-copy">{mode === "sign-in" ? "Sign in to continue to your personal finance workspace." : "Start tracking your income and expenses today."}</p><form onSubmit={submit} className="auth-form">{mode === "sign-up" && <label>Full name<input value={fullName} onChange={(event) => setFullName(event.target.value)} required placeholder="Your full name" /></label>}<label>Email address<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required placeholder="you@example.com" /></label><label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={6} placeholder="At least 6 characters" /></label>{error && <p className="auth-error">{error}</p>}{message && <p className="auth-message">{message}</p>}<button className="add-button auth-submit" disabled={submitting}>{submitting ? "Please wait…" : mode === "sign-in" ? "Sign in" : "Create account"}</button></form><button className="auth-switch" disabled={submitting} onClick={() => { setMode(mode === "sign-in" ? "sign-up" : "sign-in"); setError(""); setMessage(""); }}>{mode === "sign-in" ? "New to Pocketwise? Create an account" : "Already have an account? Sign in"}</button></section></main> }
