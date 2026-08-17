$ErrorActionPreference = 'Stop'
$base = 'http://localhost:4000/api'
$pass = 0; $fail = 0
function Check($name, $cond) {
  if ($cond) { $script:pass++; Write-Output "  OK  $name" }
  else { $script:fail++; Write-Output "  FAIL $name" }
}

# --- demo login + dashboard ---
$s = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$login = Invoke-RestMethod -Uri "$base/auth/login" -Method Post -WebSession $s -ContentType 'application/json' -Body '{"email":"demo@keluarga.test","password":"demo12345"}'
Check "demo login" ($login.user.name -eq 'Demo Keluarga')
$dash = Invoke-RestMethod -Uri "$base/dashboard" -Method Get -WebSession $s
Check "dashboard totals" ($dash.monthIncome -gt 0 -and $dash.monthExpense -gt 0 -and $dash.trend.Count -eq 6)
Check "budget recommendation" ($dash.budgetRecommendation -gt 0)

# --- transactions CRUD ---
$cats = Invoke-RestMethod -Uri "$base/categories" -Method Get -WebSession $s
Check "categories seeded (12)" ($cats.categories.Count -eq 12)
$cFood = $cats.categories | Where-Object { $_.type -eq 'expense' -and $_.name -eq 'Makanan' } | Select-Object -First 1
$cTrans = $cats.categories | Where-Object { $_.type -eq 'expense' -and $_.name -eq 'Transportasi' } | Select-Object -First 1
$t = Invoke-RestMethod -Uri "$base/transactions" -Method Post -WebSession $s -ContentType 'application/json' -Body (@{type='expense';categoryId=$cFood.id;amount=50000;note='Smoke test';date='2026-08-16'} | ConvertTo-Json)
Check "transaction create" ($t.transaction.id -gt 0)
$upd = Invoke-RestMethod -Uri "$base/transactions/$($t.transaction.id)" -Method Patch -WebSession $s -ContentType 'application/json' -Body (@{type='expense';categoryId=$cTrans.id;amount=60000;note='Smoke edited';date='2026-08-16'} | ConvertTo-Json)
Check "transaction patch" ($upd.transaction.amount -eq 60000)
$del = Invoke-RestMethod -Uri "$base/transactions/$($t.transaction.id)" -Method Delete -WebSession $s
Check "transaction delete" ($del.ok -eq $true)
try { Invoke-RestMethod -Uri "$base/transactions" -Method Post -WebSession $s -ContentType 'application/json' -Body '{"type":"expense","categoryId":1,"amount":-1,"date":"2026-08-01"}' | Out-Null; Check "amount validation" $false } catch { Check "amount validation" $true }

# --- budgets ---
$auto = Invoke-RestMethod -Uri "$base/budgets/auto" -Method Post -WebSession $s -ContentType 'application/json' -Body (@{month=$dash.month} | ConvertTo-Json)
Check "budget auto 50/30/20" ($auto.total -gt 0 -and $auto.savings -gt 0)
$buds = Invoke-RestMethod -Uri "$base/budgets?month=$($dash.month)" -Method Get -WebSession $s
Check "budget list has allocations" (@($buds.budgets | Where-Object { $_.allocated -gt 0 }).Count -gt 0)
$items = @($buds.budgets | Where-Object { $_.allocated -gt 0 } | Select-Object -First 2 | ForEach-Object { @{categoryId=$_.categoryId; allocated=$_.allocated} })
$bulk = Invoke-RestMethod -Uri "$base/budgets/bulk" -Method Post -WebSession $s -ContentType 'application/json' -Body (@{month=$dash.month; items=$items} | ConvertTo-Json -Depth 5)
Check "budget bulk save" ($bulk.ok -eq $true)
try { Invoke-RestMethod -Uri "$base/budgets/bulk" -Method Post -WebSession $s -ContentType 'application/json' -Body '{"month":"2026-08","items":[{"categoryId":1,"allocated":99999999999}]}' | Out-Null; Check "budget over-limit rejected" $false } catch { Check "budget over-limit rejected" $true }

# --- reminders ---
$r = Invoke-RestMethod -Uri "$base/reminders" -Method Post -WebSession $s -ContentType 'application/json' -Body '{"title":"Uang saku anak","amount":300000,"recurrence":"weekly","dueDate":"2026-08-20"}'
Check "reminder create" ($r.reminder.status -eq 'active')
$rc = Invoke-RestMethod -Uri "$base/reminders/$($r.reminder.id)/complete" -Method Patch -WebSession $s
Check "reminder complete" ($rc.reminder.status -eq 'completed')

# --- family flow ---
$s2 = New-Object Microsoft.PowerShell.Commands.WebRequestSession
Invoke-RestMethod -Uri "$base/auth/register" -Method Post -WebSession $s2 -ContentType 'application/json' -Body '{"name":"Ani","email":"ani@keluarga.test","password":"rahasia123"}' | Out-Null
$f0 = Invoke-RestMethod -Uri "$base/family" -Method Get -WebSession $s2
Check "new user no family" ($f0.family -eq $null)
$fam = Invoke-RestMethod -Uri "$base/family" -Method Post -WebSession $s2 -ContentType 'application/json' -Body '{"name":"Keluarga Ani"}'
Check "family create admin" ($fam.family.myRole -eq 'admin')
$inv = Invoke-RestMethod -Uri "$base/family/invite" -Method Post -WebSession $s2 -ContentType 'application/json' -Body '{}'
Check "invite code" ($inv.invitation.code.Length -eq 8)
$s3 = New-Object Microsoft.PowerShell.Commands.WebRequestSession
Invoke-RestMethod -Uri "$base/auth/register" -Method Post -WebSession $s3 -ContentType 'application/json' -Body '{"name":"Rizky","email":"rizky@keluarga.test","password":"rahasia123"}' | Out-Null
$join = Invoke-RestMethod -Uri "$base/family/join" -Method Post -WebSession $s3 -ContentType 'application/json' -Body (@{code=$inv.invitation.code} | ConvertTo-Json)
Check "join family" ($join.family.name -eq 'Keluarga Ani')
$f1 = Invoke-RestMethod -Uri "$base/family" -Method Get -WebSession $s2
Check "admin sees 2 members" ($f1.family.members.Count -eq 2)
$member = $f1.family.members | Where-Object { $_.name -eq 'Rizky' }
Invoke-RestMethod -Uri "$base/family/members/$($member.userId)" -Method Patch -WebSession $s2 -ContentType 'application/json' -Body '{"visibility":"private"}' | Out-Null
try { Invoke-RestMethod -Uri "$base/family/member/$($member.userId)/transactions" -Method Get -WebSession $s2 | Out-Null; Check "private visibility blocks admin" $false } catch { Check "private visibility blocks admin" $true }

# --- auth protection ---
$s4 = New-Object Microsoft.PowerShell.Commands.WebRequestSession
try { Invoke-RestMethod -Uri "$base/transactions" -Method Get -WebSession $s4 | Out-Null; Check "unauthenticated blocked" $false } catch { Check "unauthenticated blocked" $true }

Write-Output ""
Write-Output "RESULT: $pass passed, $fail failed"
