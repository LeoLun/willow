<template>
  <div class="weather">
    <template v-for="(forecast, index) in forecastList">
      <WeatherCard :forecast="forecast" :class="{
        'yesterday': index === 0,
        'today': index === 1,
      }" />
    </template>
    <div id="chart-days" class="weather-chart">

    </div>
  </div>
</template>

<script setup lang="ts">
import { IForecast } from '../../../shared/type/weather';
import { electronAPI } from '../lib/ipc'
import WeatherCard from './WeatherCard.vue';
import { onMounted, ref, onUnmounted } from 'vue'
import * as echarts from 'echarts'
import { TimeService } from '../services/time-services';

const forecastList = ref<IForecast[]>()
let myChart;

const resetChartData = (myChart: echarts.ECharts, forecasts: IForecast[]) => {
  // 获取当前窗口高度
  const windowHeight = window.innerHeight;
  // 设置图表高度为窗口高度的 10%
  const chartHeight = windowHeight * 0.15;
  // 获取 weather 节点宽度
  const weatherWidth = document.querySelector('.weather')?.clientWidth || 0;
  // 设置图表宽度为 weather 节点宽度
  const chartWidth = weatherWidth;
  // 计算字体大小为 2vmin
  const fontSize = Math.min(windowHeight, weatherWidth) * 0.025;


  const chartLabelData: string[] = [];
  const chartMaxData: number[] = [];
  const chartMinData: number[] = [];
  forecasts.forEach((forecast) => {
    chartLabelData.push(forecast.time);
    // 可能出现 max 小于 min 的情况，这里做一个判断
    const max = Math.max(parseInt(forecast.max_degree), parseInt(forecast.min_degree));
    const min = Math.min(parseInt(forecast.max_degree), parseInt(forecast.min_degree));

    chartMaxData.push(max);
    chartMinData.push(min);
  });


  const option = {
    visualMap: {
      show: false,
      type: 'continuous',
      dimension: 0,
      min: 0,
      max: 8,
      inRange: {
        color: ['#00c9a7', '#845ec2']
      }
    },
    animation: false,
    // renderAsImage: true,
    tooltip: {
      show: false,
    },
    xAxis: [{
      type: 'category',
      show: false,
      data: chartLabelData,
    }],
    yAxis: [{
      type: 'value',
      show: false,
      boundaryGap: ['45%', '45%'],
      scale: true,
    }],
    grid: {
      x: 0,
      y: 0,
      y2: 0,
      height: chartHeight,
      width: chartWidth,
      borderWidth: "0px",
    },
    series: [{
      type: 'line',
      data: chartMaxData,
      smooth: true,
      symbol: 'circle',
      symbolSize: 8,
      clipOverflow: false,
      lineStyle: {
        normal: {
          width: 3
        },
      },
      label: {
        normal: {
          show: true,
          textStyle: {
            fontSize: fontSize,
            fontFamily: '微软雅黑',
            color: "#FFFFFF",
          },
          distance: 10,
          formatter: function (val: any) {
            if (val.dataIndex == 0) {
              return `{first|${val.data}°}`;
            };
            return `${val.data}°`;
          },
          rich: {
            first: {
              fontSize: fontSize,
              fontFamily: '微软雅黑',
              color: "#FFFFFF4D",
            },
          },
        },
      },
    },
    {
      type: 'line',
      data: chartMinData,
      smooth: true,
      symbol: 'circle',
      symbolSize: 8,
      lineStyle: {
        normal: {
          width: 3,
        },
      },
      label: {
        normal: {
          show: true,
          position: "bottom",
          textStyle: {
            fontSize: fontSize,
            fontFamily: '微软雅黑',
            color: "#FFFFFF",
          },
          distance: 10,
          formatter: function (val: any) {
            if (val.dataIndex == 0) {
              return `{first|${val.data}°}`;
            };
            return `${val.data}°`;
          },
          rich: {
            first: {
              fontSize: fontSize,
              fontFamily: '微软雅黑',
              color: "#FFFFFF4D",
            },
          },
        },
      },
    },
    ],
  };
  myChart.setOption(option);
}

const init  = async (myChart) => {
  const { forecasts } = await electronAPI.fetchWeather()
  forecastList.value = forecasts
  resetChartData(myChart, forecasts)
}

const handleResize = () => {
  if (myChart) {
    setTimeout(() => {
      init(myChart)
    }, 500);
  }
}

onMounted(async () => {
  // 基于准备好的dom，初始化echarts图表
  myChart = echarts.init(document.getElementById('chart-days'));
  await init(myChart)
  TimeService.onDayChange(async () => {
    await init(myChart)
  })
  window.addEventListener('resize', handleResize);
})

onUnmounted(() => {
  if (myChart) {
    myChart.dispose();
    myChart = null;
  }
  window.removeEventListener('resize', handleResize);
})
</script>

<style scoped>
.weather {
  box-sizing: border-box;
  position: relative;
  display: flex;
  width: 80%;
  flex-direction: row;
}

.weather-chart {
  width: 100%;
  height: 15vh;
  position: absolute;
  top: 11vmin;
}

.yesterday {
  opacity: .3;
}

.today {
  background-color: #212121;
}
</style>