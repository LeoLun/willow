const init = async () => {
  const response = await fetch(`https://wis.qq.com/weather/common?source=pc&weather_type=forecast_24h&province=%E5%B9%BF%E4%B8%9C%E7%9C%81&city=%E7%8F%A0%E6%B5%B7%E5%B8%82&county=%E9%A6%99%E6%B4%B2%E5%8C%BA`);
  const data = await response.json();
  console.log('data', data)
}

init()


// https://r.inews.qq.com/api/ip2city

// https://wis.qq.com/weather/common?source=pc&weather_type=observe|forecast_1h|forecast_24h|index|alarm|limit|tips|rise&province=%E5%B9%BF%E4%B8%9C%E7%9C%81&city=%E7%8F%A0%E6%B5%B7%E5%B8%82&county=%E9%A6%99%E6%B4%B2%E5%8C%BA


define('days',['jquery', 'templateModule'], function($, template) {
  moment.locale('zh-cn', {
      weekdaysShort: '周日_周一_周二_周三_周四_周五_周六'.split('_')
  });
  function init(data) {
      const formatData = [],
          chartLabelData = [],
          chartMaxData = [],
          chartMinData = [];
      const today = moment();
      for (let i = 0; i < 8; i++) {
          const item = data[i];
          if (item.day_weather_short && item.night_weather_short && item.max_degree && item.min_degree) {
              if (moment(item.time).add(1, 'days').isSame(today, 'day')) {
                  item.showText = "昨天";
              } else if (moment(item.time).isSame(today, 'day')) {
                  item.showText = "今天";
              } else if (moment(item.time).subtract(1, 'days').isSame(today, 'day')) {
                  item.showText = "明天";
              } else if (moment(item.time).subtract(2, 'days').isSame(today, 'day')) {
                  item.showText = "后天";
              } else {
                  item.showText = moment(item.time).format('ddd');
              };
              chartLabelData.push(item.time);
              chartMaxData.push(item.max_degree - 0);
              chartMinData.push(item.min_degree - 0);
              if (item.time) {
                  item.formatTime = `${item.time.substring(5).replace('-', '月')}日`;
              };
              formatData.push(item);
          };
      };

      const itemWidth = Math.floor(740 / formatData.length);

      $("#ls-weather-day").html(template("days", { data: formatData, itemWidth: itemWidth }));

      // 基于准备好的dom，初始化echarts图表
      const myChart = echarts.init(document.getElementById('chart-days'));
      option = {
          backgroundColor: "rgba(0,0,0,0.0)",
          color: ["#FCC370", "#94CCF9"],
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
              height: 174,
              width: 740,
              borderWidth: "0px",
          },
          // legend: {
          //     orient: 'horizontal',
          //     x: 'center',
          //     y: 'top',
          //     itemGap: 55
          // },
          series: [{
                  type: 'line',
                  data: chartMaxData,
                  smooth: true,
                  symbol: 'circle',
                  symbolSize: 8,
                  clipOverflow: false,
                  lineStyle: {
                      normal: {
                          width: 3,
                      },
                  },
                  label: {
                      normal: {
                          show: true,
                          textStyle: {
                              fontSize: '18',
                              fontFamily: '微软雅黑',
                              color: "#384C78",
                          },
                          distance: 10,
                          formatter: function(val) {
                              if (val.dataIndex == 0) {
                                  return `{first|${val.data}°}`;
                              };
                              return `${val.data}°`;
                          },
                          rich: {
                              first: {
                                  fontSize: '18',
                                  fontFamily: '微软雅黑',
                                  color: "#C2C2C2",
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
                              fontSize: '18',
                              fontFamily: '微软雅黑',
                              color: "#555555",
                          },
                          distance: 10,
                          formatter: function(val) {
                              if (val.dataIndex == 0) {
                                  return `{first|${val.data}°}`;
                              };
                              return `${val.data}°`;
                          },
                          rich: {
                              first: {
                                  fontSize: '18',
                                  fontFamily: '微软雅黑',
                                  color: "#C2C2C2",
                              },
                          },
                      },
                  },
              },
          ],
      };
      myChart.setOption(option);
  };
  return {
      init: init,
  };
});