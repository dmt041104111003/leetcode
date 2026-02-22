"use strict";

$(function () {
  bodymovin.loadAnimation({
    container: document.querySelector(".service .globe .puff"),
    renderer: "svg",
    loop: true,
    autoplay: true,
    animationData: window.globePuffAnimation
  });
  var width = 400,
      height = 400;
  var projection = d3.geo.orthographic().scale(200).translate([width / 2, height / 2]).clipAngle(90);
  var path = d3.geo.path().projection(projection);
  var λ = d3.scale.linear().domain([0, width]).range([-180, 180]);
  var φ = d3.scale.linear().domain([0, height]).range([90, -90]);
  var svg = d3.select(".service .globe .worldmap").append("svg").attr("width", width).attr("height", height);
  var world = window.worldMapData;
  svg.append("path").datum(topojson.feature(world, world.objects.land)).attr("class", "land").attr("d", path);
  var scrollSpeed = 50;
  var current = 0;

  function bgscroll() {
    current += 0.5;
    projection.rotate([λ(current), 0]);
    svg.selectAll("path").attr("d", path);
  }

});