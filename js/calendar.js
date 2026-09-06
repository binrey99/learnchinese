const calendarDays = [
  ['29', true], ['30', true], ['31', true], ['1', false], ['2', false], ['3', false], ['4', false],
  ['5', false], ['6', false], ['7', false], ['8', false], ['9', false], ['10', false], ['11', false],
  ['12', false, 'today'], ['13', false, 'done'], ['14', false, 'done'], ['15', false, 'done'], ['16', false, 'done'], ['17', false, 'done'], ['18', false],
  ['19', false], ['20', false], ['21', false], ['22', false], ['23', false], ['24', false], ['25', false],
  ['26', false], ['27', false], ['28', false], ['29', false], ['30', false], ['31', false], ['1', true]
];

export function renderCalendar(selector = '#calendarDays') {
  const container = document.querySelector(selector);
  if (!container) return;

  calendarDays.forEach(([label, muted, state]) => {
    const day = document.createElement('span');
    day.textContent = label;
    if (muted) day.classList.add('muted');
    if (state) day.classList.add(state);
    container.appendChild(day);
  });
}
