import './viz.css';

import { select } from 'd3-selection';
import { dsv } from 'd3-fetch';
import { scaleBand, scaleLinear } from 'd3-scale';
import { arc } from 'd3-shape';
import { extent } from 'd3-array';

const ICON_SIZE = 12;
const PATH_ECONOMICS =
  'M10,21V19H6.41L10.91,14.5L9.5,13.09L5,17.59V14H3V21H10M14.5,10.91L19,6.41V10H21V3H14V5H17.59L13.09,9.5L14.5,10.91Z';
const PATH_EXT_CONFLICT =
  'M6.2,2.44L18.1,14.34L20.22,12.22L21.63,13.63L19.16,16.1L22.34,19.28C22.73,19.67 22.73,20.3 22.34,20.69L21.63,21.4C21.24,21.79 20.61,21.79 20.22,21.4L17,18.23L14.56,20.7L13.15,19.29L15.27,17.17L3.37,5.27V2.44H6.2M15.89,10L20.63,5.26V2.44H17.8L13.06,7.18L15.89,10M10.94,15L8.11,12.13L5.9,14.34L3.78,12.22L2.37,13.63L4.84,16.1L1.66,19.29C1.27,19.68 1.27,20.31 1.66,20.7L2.37,21.41C2.76,21.8 3.39,21.8 3.78,21.41L7,18.23L9.44,20.7L10.85,19.29L8.73,17.17L10.94,15Z';
const PATH_INT_CONFLICT =
  'M19.03 6.03L20 7L22 2L17 4L17.97 4.97L16.15 6.79C10.87 2.16 3.3 3.94 2.97 4L2 4.26L2.5 6.2L3.29 6L10.12 12.82L6.94 16H5L2 19L4 20L5 22L8 19V17.06L11.18 13.88L18 20.71L17.81 21.5L19.74 22L20 21.03C20.06 20.7 21.84 13.13 17.21 7.85L19.03 6.03M4.5 5.78C6.55 5.5 11.28 5.28 14.73 8.21L10.82 12.12L4.5 5.78M18.22 19.5L11.88 13.18L15.79 9.27C18.72 12.72 18.5 17.45 18.22 19.5Z';
const PATH_LEADERSHIP =
  'M19,22H5V20H19V22M17,10C15.58,10 14.26,10.77 13.55,12H13V7H16V5H13V2H11V5H8V7H11V12H10.45C9.35,10.09 6.9,9.43 5,10.54C3.07,11.64 2.42,14.09 3.5,16C4.24,17.24 5.57,18 7,18H17A4,4 0 0,0 21,14A4,4 0 0,0 17,10Z';
const PATH_UNKNOWN =
  'M10,19H13V22H10V19M12,2C17.35,2.22 19.68,7.62 16.5,11.67C15.67,12.67 14.33,13.33 13.67,14.17C13,15 13,16 13,17H10C10,15.33 10,13.92 10.67,12.92C11.33,11.92 12.67,11.33 13.5,10.67C15.92,8.43 15.32,5.26 12,5A3,3 0 0,0 9,8H6A6,6 0 0,1 12,2Z';
const PATH_OVERSTRETCH =
  'M3,6H21V18H3V6M12,9A3,3 0 0,1 15,12A3,3 0 0,1 12,15A3,3 0 0,1 9,12A3,3 0 0,1 12,9M7,8A2,2 0 0,1 5,10V14A2,2 0 0,1 7,16H17A2,2 0 0,1 19,14V10A2,2 0 0,1 17,8H7Z';

const collapseIcon = {
  economics: PATH_ECONOMICS,
  'external conflict': PATH_EXT_CONFLICT,
  'internal conflict': PATH_INT_CONFLICT,
  'leadership issues': PATH_LEADERSHIP,
  overstretch: PATH_OVERSTRETCH,
  unknown: PATH_UNKNOWN,
};

const typesOfGoverments = [
  'autocracy',
  'bureaucracy',
  'monarchy',
  'stratocracy',
  'theocracy',
];

const INNER_RADIUS = 0.1;
const OUTER_RADIUS = 0.75;

const PADDING_EMPIRE_LABELS = 20;

const FONT_SIZE_RANGE = [10, 30];

const DURATION_DOMAIN = [0, 1000];

// TODO: Make this an automatic calculation
const DURATION_TICKS = [250, 500, 830];
const GOLDEN_AGE_TICKS = [0.25, 0.5, 0.83];

const TITLE = 'Age of Empires';
const SUBTITLE = 'If every dynasty lasted 100 years...';
const margin = {
  top: 0,
  right: 0,
  bottom: 60,
  left: 0,
};

function polar2Cartesian({ r, theta }) {
  return {
    x: r * Math.cos(theta),
    y: r * Math.sin(theta),
  };
}

async function loadAverages() {
  let averages = {};

  await dsv(',', 'data/timeline-of-empires.csv', (d, i) => {
    const { duration, peakPerc, declinePerc } = d;
    if (i === 0) {
      averages = {
        duration: +duration,
        startOfPeak: +peakPerc.replace('%', '') / 100,
        startOfDecline: +declinePerc.replace('%', '') / 100,
      };
    }
  });

  return averages;
}

async function loadData() {
  return await dsv(',', 'data/age-of-empires.csv', (d) => ({
    empire: d.empire,
    styleOfRule: d.styleOfRule,
    duration: +d.totalDuration,
    decimalPeakStart: +d.decimalPeakStart,
    decimalDeclineStart: +d.decimalDeclineStart,
    era: d.era,
    worldCoveragePerc: +d.worldCoveragePerc / 100,
    reasonForDecline: d.reasonForDecline,
    durationFrom: +d.durationFrom,
  }));
}

export async function init(container, { width, height }) {
  const averages = await loadAverages();
  let data = await loadData();

  const innerHeight = height - margin.top - margin.bottom;
  const innerWidth = width - margin.left - margin.right;
  const side = Math.min(innerWidth / 2, innerHeight);

  const innerR = side * INNER_RADIUS;
  const outerR = side * OUTER_RADIUS;

  // note the min. height only contain one radius, width contains two of them.
  const svgEl = select(container);
  const wrapper = svgEl
    .append('g')
    .attr(
      'transform',
      `translate(${margin.left + innerWidth / 2}, ${margin.top + innerHeight})`
    );
  console.log('data', data);
  console.log('averages', averages);

  const bandScale = scaleBand()
    .domain(data.map((d) => d.empire))
    .range([-Math.PI / 2, Math.PI / 2])
    .align(0);
  const rScale = scaleLinear().domain(DURATION_DOMAIN).range([innerR, outerR]);
  const r2Scale = scaleLinear().domain([0, 1]).range([innerR, outerR]);
  const fontSizeScale = scaleLinear()
    .domain(extent(data, (d) => d.worldCoveragePerc))
    .range(FONT_SIZE_RANGE);

  const rAxisArc = arc()
    .innerRadius(rScale)
    .outerRadius(rScale)
    .startAngle(-Math.PI / 2)
    .endAngle(Math.PI / 2);
  const rAxisLabelArc = arc()
    .innerRadius(rScale)
    .outerRadius(rScale)
    .startAngle(-Math.PI / 4 + Math.PI / 32)
    .endAngle(-Math.PI / 4 - Math.PI / 32);

  const arcGen = arc()
    .innerRadius(rScale(0))
    .outerRadius((d) => rScale(d.duration))
    .startAngle((d) => bandScale(d.empire))
    .endAngle((d) => bandScale(d.empire) + bandScale.bandwidth())
    .padRadius(0);

  data = data.map((d) => {
    const angle = bandScale(d.empire) + bandScale.bandwidth() / 2 - Math.PI / 2;
    const getCoords = (r) => polar2Cartesian({ r, theta: angle });

    const min = getCoords(innerR);
    const max = getCoords(outerR);
    const peak = getCoords(r2Scale(d.decimalPeakStart));
    const decline = getCoords(r2Scale(d.decimalDeclineStart));
    return {
      ...d,
      goldenAge: { min, max, peak, decline },
    };
  });

  const barsG = wrapper.append('g').classed('bars', true);
  barsG
    .selectAll('path')
    .data(data)
    .join('path')
    .classed('bar', true)
    .attr('d', arcGen);

  const goldenAgeG = wrapper.append('g');
  const goldenAges = goldenAgeG
    .selectAll('g')
    .data(data.map((d) => d.goldenAge))
    .join('g');
  goldenAges
    .append('line')
    .classed('goldenAge--start', true)
    .attr('x1', (d) => d.min.x)
    .attr('y1', (d) => d.min.y)
    .attr('x2', (d) => d.peak.x)
    .attr('y2', (d) => d.peak.y);
  goldenAges
    .append('line')
    .classed('goldenAge', true)
    .attr('x1', (d) => d.peak.x)
    .attr('y1', (d) => d.peak.y)
    .attr('x2', (d) => d.decline.x)
    .attr('y2', (d) => d.decline.y)
    .attr('stroke', 'pink');
  goldenAges
    .append('line')
    .classed('goldenAge--end', true)
    .attr('x1', (d) => d.decline.x)
    .attr('y1', (d) => d.decline.y)
    .attr('x2', (d) => d.max.x)
    .attr('y2', (d) => d.max.y);
  goldenAges
    .append('circle')
    .classed('goldenAge--peak', true)
    .attr('cx', (d) => d.peak.x)
    .attr('cy', (d) => d.peak.y);
  goldenAges
    .append('circle')
    .classed('goldenAge--decline', true)
    .attr('cx', (d) => d.decline.x)
    .attr('cy', (d) => d.decline.y);

  // REASON FOR COLLAPSE ICONS
  const collapsesG = wrapper.append('g');
  const collapses = collapsesG.selectAll('g').data(data).join('g');
  const collapsesGs = collapses.append('g').attr('transform', (d) => {
    const { x, y } = d.goldenAge.max;
    return `translate(${x}, ${y})`;
  });
  addColapseIcon(collapsesGs, (d) => collapseIcon[d.reasonForDecline]);

  const isInSecondHalf = (d) => bandScale(d.empire) + bandScale.bandwidth() > 0;

  const empiresAxis = (g) =>
    g.call((g) =>
      g
        .selectAll('g')
        .data(data)
        .join('g')
        .attr(
          'transform',
          (d) => `
          rotate(${
            ((bandScale(d.empire) + bandScale.bandwidth() / 2) * 180) /
              Math.PI -
            90
          })
          translate(${outerR + PADDING_EMPIRE_LABELS},0)
        `
        )
        .call((g) =>
          g
            .append('text')
            .attr('class', (d) => d.styleOfRule)
            .attr('transform', (d) =>
              isInSecondHalf(d) ? 'rotate(0)' : 'rotate(180)'
            )
            .attr('text-anchor', (d) => (isInSecondHalf(d) ? 'start' : 'end'))
            .attr('alignment-baseline', 'middle')
            .attr('font-size', (d) => `${fontSizeScale(d.worldCoveragePerc)}px`)
            .text((d) => d.empire)
        )
    );

  // RADIAL AXIS
  const rGuides = wrapper.append('g');
  rGuides
    .selectAll('path')
    .data(DURATION_TICKS)
    .join('path')
    .classed('guide', true)
    .attr('d', rAxisArc);
  rGuides
    .append('path')
    .classed('guide', true)
    .style('stroke-opacity', 0.15)
    .attr('d', (_) => rAxisArc(1300));
  rGuides
    .append('path')
    .classed('guide', true)
    .classed('guideStrong', true)
    .attr('d', (_) => rAxisLabelArc(1300));
  const rGuideTextCoord = polar2Cartesian({
    r: rScale(1325),
    theta: -Math.PI / 4,
  });
  rGuides
    .append('g')
    .attr('transform', `translate(${-rGuideTextCoord.x}, ${rGuideTextCoord.y})`)
    .append('text')
    .classed('rGuideLabel', true)
    .style('transform', 'rotateZ(-45deg)')
    .text('antiquity of empire');
  const rGuideArrowCoord = polar2Cartesian({
    r: rScale(1300),
    theta: -Math.PI / 4 + Math.PI / 32,
  });
  rGuides
    .append('g')
    .attr(
      'transform',
      `translate(${-rGuideArrowCoord.x}, ${rGuideArrowCoord.y})`
    )
    .append('path')
    .classed('rGuideArrow', true)
    .attr('d', 'M 0 0 v 5 L 5 0 L 0 -5 z')
    .attr('transform', 'rotate(135)');

  // Actual duration axis
  const rAxis = rGuides.append('g').attr('transform', 'translate(0, 10)');
  rAxis
    .append('rect')
    .classed('bar', true)
    .attr('width', outerR - innerR)
    .attr('height', 16)
    .attr('x', innerR);
  rAxis
    .selectAll('text')
    .data(DURATION_TICKS)
    .join('text')
    .classed('radialAxisLabel', true)
    .text((d, i) => (i === 0 ? `${d} years` : d))
    .attr('dx', (d) => rScale(d) - 9)
    .attr('dy', 10);
  rAxis
    .append('text')
    .classed('radialAxisLabel', true)
    .attr('dx', innerR + 2)
    .attr('dy', 10)
    .text('actual duration');
  rAxis
    .append('text')
    .classed('radialAxisLabel', true)
    .attr('dx', outerR - 2)
    .attr('dy', 10)
    .attr('text-anchor', 'end')
    .text('1000');

  // Percent axis
  const goldenAgeAxis = rGuides
    .append('g')
    .attr('transform', 'translate(0, 18)');
  goldenAgeAxis
    .append('line')
    .classed('goldenAxisLine', true)
    .attr('x1', -outerR)
    .attr('x2', -innerR - 40);
  const goldenAxisLabels = goldenAgeAxis
    .selectAll('g')
    .data(GOLDEN_AGE_TICKS)
    .join('g')
    .attr('transform', (d) => `translate(${-r2Scale(d) - 10}, 0)`);
  goldenAxisLabels
    .append('rect')
    .classed('hiddenBox', true)
    .attr('width', 30)
    .attr('height', 14)
    .attr('x', -3)
    .attr('y', -7);
  goldenAxisLabels
    .append('text')
    .classed('goldenAgeAxisLabel', true)
    .text((d) => `${d * 100}%`);
  goldenAgeAxis
    .append('text')
    .classed('goldenAgeAxisLabel', true)
    .attr('text-anchor', 'end')
    .attr('dx', -innerR)
    .text('percent');
  const averageDecline = goldenAgeAxis
    .append('g')
    .attr('transform', `translate(${-r2Scale(0.83) - 10}, 12)`);
  averageDecline
    .append('text')
    .classed('averageText', true)
    .text('average start');
  averageDecline
    .append('text')
    .classed('averageText', true)
    .attr('dy', 12)
    .text('of decline');
  const averagePeak = goldenAgeAxis
    .append('g')
    .attr('transform', `translate(${-r2Scale(0.5) - 10}, 12)`);
  averagePeak.append('text').classed('averageText', true).text('average start');
  averagePeak
    .append('text')
    .classed('averageText', true)
    .attr('dy', 12)
    .text('of peak');

  // AGE AXIS
  const ageAxis = wrapper.append('g');
  const [minAge, maxAge] = extent(data, (d) => d.durationFrom);
  const formatAge = (age) => (age < 0 ? `${Math.abs(age)} BCE` : `${age} CE`);
  ageAxis
    .append('text')
    .classed('ageLabel', true)
    .attr('dx', outerR + 87)
    .text(formatAge(maxAge));
  ageAxis
    .append('text')
    .classed('ageLabel', true)
    .attr('dx', -outerR - 64)
    .text(formatAge(minAge));

  wrapper.append('g').call(empiresAxis);

  addTitleAndSubtitle(svgEl);
  addGovLegend(svgEl);
  addCollapseLegend(svgEl, width);
  addOtherLegends(svgEl, width);
}

function addColapseIcon(wrapper, collapseExtractor) {
  wrapper.append('circle').classed('iconBg', true);
  wrapper
    .append('g')
    .attr('transform', `translate(-${ICON_SIZE / 2},-${ICON_SIZE / 2})`)
    .append('svg')
    .attr('width', ICON_SIZE)
    .attr('height', ICON_SIZE)
    .attr('viewBox', '0 0 24 24')
    .append('path')
    .classed('icon', true)
    .attr('d', collapseExtractor);
}

function addTitleAndSubtitle(wrapper) {
  const title = wrapper.append('g').attr('transform', 'translate(50, 50)');
  title.append('text').classed('title', true).text(TITLE);
  title.append('text').classed('subtitle', true).attr('dy', 22).text(SUBTITLE);
}

function addGovLegend(wrapper) {
  const govTypeLegend = wrapper
    .append('g')
    .attr('transform', 'translate(50, 150)');
  govTypeLegend
    .append('text')
    .classed('typeGovLegend', true)
    .text('type of government');

  const govTypeLegendValues = wrapper
    .append('g')
    .attr('transform', 'translate(50, 170)');
  govTypeLegendValues
    .selectAll('text')
    .data(typesOfGoverments)
    .join('text')
    .attr('class', (d) => d)
    .classed('govTypeLegendValues', true)
    .attr('dy', (_, i) => i * 14)
    .text((d) => d);
}

function addOtherLegends(wrapper, width) {
  const group = wrapper
    .append('g')
    .attr('transform', `translate(${width - 200}, 50)`);

  const sizeLegend = group.append('g').classed('empireSize', true);
  sizeLegend.append('text').text('Size of');
  sizeLegend.append('text').classed('em1', true).attr('dx', 40).text('Empire');
  sizeLegend.append('text').attr('dx', 93).text('at');
  sizeLegend.append('text').classed('em2', true).attr('dx', 106).text('Peak');

  const durationLegend = group
    .append('g')
    .attr('transform', 'translate(0, 12)');
  durationLegend
    .append('rect')
    .classed('bar', true)
    .attr('width', 152)
    .attr('height', 18);
  durationLegend
    .append('text')
    .classed('durationLegendText', true)
    .attr('dx', 152 / 2)
    .attr('dy', 18 / 2)
    .text('actual duration (years)');

  const stopX1 = 20;
  const stopX2 = 152 - 20;
  const goldenAgeLegend = group
    .append('g')
    .attr('transform', 'translate(0, 40)');
  const goldenAgeLineG = goldenAgeLegend
    .append('g')
    .attr('transform', 'translate(0, 24)');
  goldenAgeLineG
    .append('line')
    .classed('goldenAge--start', true)
    .attr('x1', 0)
    .attr('x2', stopX1);
  goldenAgeLineG
    .append('line')
    .classed('goldenAge', true)
    .attr('x1', stopX1)
    .attr('x2', stopX2);
  goldenAgeLineG
    .append('line')
    .classed('goldenAge--end', true)
    .attr('x1', stopX2)
    .attr('x2', 152);
  goldenAgeLineG
    .append('circle')
    .classed('goldenAge--peak', true)
    .attr('cx', stopX1);
  goldenAgeLineG
    .append('circle')
    .classed('goldenAge--decline', true)
    .attr('cx', stopX2);
  goldenAgeLineG
    .append('text')
    .classed('goldenAgeLegendText', true)
    .attr('dx', 152 / 2)
    .attr('dy', 10)
    .text('golden age');

  const peakLabel = goldenAgeLineG
    .append('g')
    .classed('goldenAge--label', true)
    .attr('transform', `translate(${stopX1}, -20)`);
  peakLabel.append('text').text('start of');
  peakLabel.append('text').attr('dy', 10).text('peak');

  const declineLabel = goldenAgeLineG
    .append('g')
    .classed('goldenAge--label', true)
    .attr('transform', `translate(${stopX2}, -20)`);
  declineLabel.append('text').text('start of');
  declineLabel.append('text').attr('dy', 10).text('decline');
}

function addCollapseLegend(wrapper, width) {
  const collapseLegend = wrapper
    .append('g')
    .attr('transform', `translate(${width - 200}, 150)`);
  collapseLegend
    .append('text')
    .classed('collapseLegend', true)
    .text('reason for collapse');

  const collapseLegendValues = wrapper
    .append('g')
    .attr('transform', `translate(${width - 200}, 170)`);

  const legendValues = collapseLegendValues
    .selectAll('g.collaseLegendValues')
    .data(Object.keys(collapseIcon))
    .join('g')
    .classed('collaseLegendValues', true)
    .attr('transform', (_, i) => `translate(${9}, ${i * 23})`);

  legendValues
    .append('text')
    .text((d) => d)
    .attr('dy', 3)
    .attr('dx', 18);

  addColapseIcon(legendValues, (d) => collapseIcon[d]);
}
