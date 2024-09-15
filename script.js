// Get DOM elements
const incomeInput = document.getElementById('income');
const needsSpan = document.getElementById('needs');
const wantsSpan = document.getElementById('wants');
const savingsSpan = document.getElementById('savings');
const monthlySavingsSpan = document.getElementById('monthlySavings');
const yearSavingsSpan = document.getElementById('yearSavings');
const fiveYearSavingsSpan = document.getElementById('fiveYearSavings');
const tenYearSavingsSpan = document.getElementById('tenYearSavings');

let budgetChart;

// Function to calculate budget
function calculateBudget() {
    let income = parseFloat(incomeInput.value);

    // Input validation
    if (isNaN(income) || income < 0) {
        income = 0;
    }

    const needs = income * 0.5;
    const wants = income * 0.3;
    const savings = income * 0.2;

    needsSpan.textContent = `$${needs.toFixed(2)}`;
    wantsSpan.textContent = `$${wants.toFixed(2)}`;
    savingsSpan.textContent = `$${savings.toFixed(2)}`;

    monthlySavingsSpan.textContent = `$${savings.toFixed(2)}`;
    yearSavingsSpan.textContent = `$${(savings * 12).toFixed(2)}`;
    fiveYearSavingsSpan.textContent = `$${(savings * 12 * 5).toFixed(2)}`;
    tenYearSavingsSpan.textContent = `$${(savings * 12 * 10).toFixed(2)}`;

    updateChart(needs, wants, savings);
}

// Function to update chart
function updateChart(needs, wants, savings) {
    const ctx = document.getElementById('budgetChart').getContext('2d');

    if (budgetChart) {
        budgetChart.destroy();
    }

    budgetChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: ['Needs (50%)', 'Wants (30%)', 'Savings/Debt (20%)'],
            datasets: [{
                data: [needs, wants, savings],
                backgroundColor: ['#d4af37', '#1a2b4f', '#20b2aa']
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: '#ffffff',
                        font: {
                            size: 14
                        }
                    }
                }
            }
        }
    });
}

// Event listener for input change
incomeInput.addEventListener('input', calculateBudget);

// Initial calculation
calculateBudget();
