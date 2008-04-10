/*
 * Copyright (C) 2007, 2008 Apple Inc.  All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions
 * are met:
 *
 * 1.  Redistributions of source code must retain the above copyright
 *     notice, this list of conditions and the following disclaimer. 
 * 2.  Redistributions in binary form must reproduce the above copyright
 *     notice, this list of conditions and the following disclaimer in the
 *     documentation and/or other materials provided with the distribution. 
 * 3.  Neither the name of Apple Computer, Inc. ("Apple") nor the names of
 *     its contributors may be used to endorse or promote products derived
 *     from this software without specific prior written permission. 
 *
 * THIS SOFTWARE IS PROVIDED BY APPLE AND ITS CONTRIBUTORS "AS IS" AND ANY
 * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL APPLE OR ITS CONTRIBUTORS BE LIABLE FOR ANY
 * DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
 * THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

WebInspector.ResourcesPanel = function()
{
    WebInspector.Panel.call(this);

    this.element.addStyleClass("resources");

    this.resourceViews = document.createElement("div");
    this.resourceViews.id = "resource-views";
    this.element.appendChild(this.resourceViews);

    this.containerElement = document.createElement("div");
    this.containerElement.id = "resources-container";
    this.containerElement.addEventListener("scroll", this._updateDividersLabelBarPosition.bind(this), false);
    this.element.appendChild(this.containerElement);

    this.sidebarElement = document.createElement("div");
    this.sidebarElement.id = "resources-sidebar";
    this.sidebarElement.className = "sidebar";
    this.containerElement.appendChild(this.sidebarElement);

    this.sidebarResizeElement = document.createElement("div");
    this.sidebarResizeElement.className = "sidebar-resizer-vertical";
    this.sidebarResizeElement.addEventListener("mousedown", this._startSidebarDragging.bind(this), false);
    this.element.appendChild(this.sidebarResizeElement);

    this.containerContentElement = document.createElement("div");
    this.containerContentElement.id = "resources-container-content";
    this.containerElement.appendChild(this.containerContentElement);

    this.summaryElement = document.createElement("div");
    this.summaryElement.id = "resources-summary";
    this.containerContentElement.appendChild(this.summaryElement);

    this.dividersElement = document.createElement("div");
    this.dividersElement.id = "resources-dividers";
    this.containerContentElement.appendChild(this.dividersElement);

    this.dividersLabelBarElement = document.createElement("div");
    this.dividersLabelBarElement.id = "resources-dividers-label-bar";
    this.containerContentElement.appendChild(this.dividersLabelBarElement);

    this.summaryGraphElement = document.createElement("canvas");
    this.summaryGraphElement.setAttribute("width", "450");
    this.summaryGraphElement.setAttribute("height", "38");
    this.summaryGraphElement.id = "resources-summary-graph";
    this.summaryElement.appendChild(this.summaryGraphElement);

    this.legendElement = document.createElement("div");
    this.legendElement.id = "resources-graph-legend";
    this.summaryElement.appendChild(this.legendElement);

    this.sidebarTreeElement = document.createElement("ol");
    this.sidebarTreeElement.className = "sidebar-tree";
    this.sidebarElement.appendChild(this.sidebarTreeElement);

    this.sidebarTree = new TreeOutline(this.sidebarTreeElement);

    var timeGraphItem = new WebInspector.SidebarTreeElement("resources-time-graph-sidebar-item", WebInspector.UIString("Time"));
    timeGraphItem.calculator = new WebInspector.ResourceTransferTimeCalculator();
    timeGraphItem.onselect = this._graphSelected.bind(this);

    var sizeGraphItem = new WebInspector.SidebarTreeElement("resources-size-graph-sidebar-item", WebInspector.UIString("Size"));
    sizeGraphItem.calculator = new WebInspector.ResourceTransferSizeCalculator();
    sizeGraphItem.onselect = this._graphSelected.bind(this);

    this.graphsTreeElement = new WebInspector.SidebarSectionTreeElement(WebInspector.UIString("GRAPHS"), {}, true);
    this.sidebarTree.appendChild(this.graphsTreeElement);

    this.graphsTreeElement.appendChild(timeGraphItem);
    this.graphsTreeElement.appendChild(sizeGraphItem);
    this.graphsTreeElement.expand();

    this.resourcesTreeElement = new WebInspector.SidebarSectionTreeElement(WebInspector.UIString("RESOURCES"), {}, true);
    this.sidebarTree.appendChild(this.resourcesTreeElement);

    this.resourcesTreeElement.expand();

    this.sortingFunction = WebInspector.ResourceSidebarTreeElement.CompareByTime;

    this.reset();

    timeGraphItem.select();
}

WebInspector.ResourcesPanel.prototype = {
    toolbarItemClass: "resources",

    get toolbarItemLabel()
    {
        return WebInspector.UIString("Resources");
    },

    show: function()
    {
        WebInspector.Panel.prototype.show.call(this);
        this._updateDividersLabelBarPosition();
        this._updateSidebarWidth();
        this.refreshIfNeeded();
    },

    resize: function()
    {
        this._updateGraphDividersIfNeeded();
        this._updateGraphBars();

        var visibleResourceView = this.visibleResourceView;
        if (visibleResourceView && "resize" in visibleResourceView)
            visibleResourceView.resize();
    },

    get visibleResourceView()
    {
        if (this.visibleResource)
            return this.visibleResource._resourcesView;
        return null;
    },

    get calculator()
    {
        return this._calculator;
    },

    set calculator(x)
    {
        this._calculator = x;
        if (this._calculator)
            this._calculator.reset();
        this._refreshAllResources(false, true, true);
        this._updateGraphDividersIfNeeded(true);
        this._updateSummaryGraph();
    },

    get sortingFunction()
    {
        return this._sortingFunction;
    },

    set sortingFunction(x)
    {
        this._sortingFunction = x;
        this._sortResourcesIfNeeded();
    },

    get needsRefresh() 
    { 
        return this._needsRefresh; 
    }, 

    set needsRefresh(x) 
    { 
        if (this._needsRefresh === x) 
            return; 
        this._needsRefresh = x; 
        if (x && this.visible) 
            this.refresh(); 
    },

    refreshIfNeeded: function() 
    { 
        if (this.needsRefresh) 
            this.refresh(); 
    },

    refresh: function()
    {
        this.needsRefresh = false;

        var staleResourcesLength = this._staleResources.length;
        for (var i = 0; i < staleResourcesLength; ++i)
            this.refreshResource(this._staleResources[i], false, true, true);

        this._staleResources = [];

        this._updateGraphDividersIfNeeded();
        this._sortResourcesIfNeeded();
        this._updateSummaryGraph();
    },

    reset: function()
    {
        if (this._calculator)
            this._calculator.reset();

        this._resources = [];
        this._staleResources = [];

        this.resourcesTreeElement.removeChildren();

        this._updateGraphDividersIfNeeded();

        this._drawSummaryGraph(); // draws an empty graph
    },

    addResource: function(resource)
    {
        this._resources.push(resource);

        var resourceTreeElement = new WebInspector.ResourceSidebarTreeElement(resource);
        resource._resourcesTreeElement = resourceTreeElement;

        resourceTreeElement.updateGraphSideWidth(this.dividersElement.offsetWidth);

        this.resourcesTreeElement.appendChild(resourceTreeElement);

        this.refreshResource(resource);
    },

    refreshResource: function(resource, skipBoundaryUpdate, skipSort, immediate)
    {
        if (!this.visible) {
            this._staleResources.push(resource);
            this.needsRefresh = true;
            return;
        }

        if (!skipBoundaryUpdate) {
            if (this._updateGraphBoundriesIfNeeded(resource, immediate))
                return; // _updateGraphBoundriesIfNeeded refreshes all resources if it returns true, so just return.
        }

        if (!skipSort) {
            if (immediate)
                this._sortResourcesIfNeeded();
            else
                this._sortResourcesSoonIfNeeded();
        }

        this._updateSummaryGraphSoon();

        if (!resource._resourcesTreeElement)
            return;

        resource._resourcesTreeElement.refresh();

        var percentages = this.calculator.computeBarGraphPercentages(resource);

        var barElement = resource._resourcesTreeElement.barElement;
        barElement.style.left = percentages.start + "%";
        barElement.style.right = (100 - percentages.end) + "%";
    },

    showResource: function(resource)
    {
        if (!resource)
            return;

        this.containerElement.addStyleClass("viewing-resource");

        if (this.visibleResource && this.visibleResource._resourcesView)
            this.visibleResource._resourcesView.hide();

        if (!resource._resourcesView)
            resource._resourcesView = this._createResourceView(resource);
        resource._resourcesView.show();

        this.visibleResource = resource;

        this._updateSidebarWidth();
    },

    closeVisibleResource: function()
    {
        this.containerElement.removeStyleClass("viewing-resource");
        this._updateDividersLabelBarPosition();
        if (this.visibleResource && this.visibleResource._resourcesView)
            this.visibleResource._resourcesView.hide();
        delete this.visibleResource;

        this._updateSidebarWidth();
    },

    handleKeyEvent: function(event)
    {
        this.sidebarTree.handleKeyEvent(event);
    },

    _makeLegendElement: function(label, value, color)
    {
        var legendElement = document.createElement("label");
        legendElement.className = "resources-graph-legend-item";

        if (color) {
            var swatch = document.createElement("canvas");
            swatch.className = "resources-graph-legend-swatch";
            swatch.setAttribute("width", "13");
            swatch.setAttribute("height", "24");

            legendElement.appendChild(swatch);

            this._drawSwatch(swatch, color);
        }

        var labelElement = document.createElement("div");
        labelElement.className = "resources-graph-legend-label";
        legendElement.appendChild(labelElement);

        var headerElement = document.createElement("div");
        var headerElement = document.createElement("div");
        headerElement.className = "resources-graph-legend-header";
        headerElement.textContent = label;
        labelElement.appendChild(headerElement);

        var valueElement = document.createElement("div");
        valueElement.className = "resources-graph-legend-value";
        valueElement.textContent = value;
        labelElement.appendChild(valueElement);

        return legendElement;
    },

    _sortResourcesSoonIfNeeded: function()
    {
        if ("_sortResourcesTimeout" in this)
            return;
        this._sortResourcesTimeout = setTimeout(this._sortResourcesIfNeeded.bind(this), 500);
    },

    _sortResourcesIfNeeded: function()
    {
        if ("_sortResourcesTimeout" in this) {
            clearTimeout(this._sortResourcesTimeout);
            delete this._sortResourcesTimeout;
        }

        var sortedElements = [].concat(this.resourcesTreeElement.children);
        sortedElements.sort(this.sortingFunction);

        var sortedElementsLength = sortedElements.length;
        for (var i = 0; i < sortedElementsLength; ++i) {
            var treeElement = sortedElements[i];
            if (treeElement === this.resourcesTreeElement.children[i])
                continue;
            this.resourcesTreeElement.removeChild(treeElement);
            this.resourcesTreeElement.insertChild(treeElement, i);
        }
    },

    _updateGraphBoundriesIfNeeded: function(resource, immediate)
    {
        var didChange = this.calculator.updateBoundries(resource);

        if (didChange) {
            if (immediate) {
                this._refreshAllResources(true, true, immediate);
                this._updateGraphDividersIfNeeded();
            } else {
                this._refreshAllResourcesSoon(true, true, immediate);
                this._updateGraphDividersSoonIfNeeded();
            }
        }

        return didChange;
    },

    _updateGraphDividersSoonIfNeeded: function()
    {
        if ("_updateGraphDividersTimeout" in this)
            return;
        this._updateGraphDividersTimeout = setTimeout(this._updateGraphDividersIfNeeded.bind(this), 500);
    },

    _updateGraphDividersIfNeeded: function(force)
    {
        if ("_updateGraphDividersTimeout" in this) {
            clearTimeout(this._updateGraphDividersTimeout);
            delete this._updateGraphDividersTimeout;
        }

        if (!this.visible) {
            this.needsRefresh = true;
            return;
        }

        if (document.body.offsetWidth <= 0) {
            // The stylesheet hasn't loaded yet, so we need to update later.
            setTimeout(this._updateGraphDividersIfNeeded.bind(this), 0);
            return;
        }

        var dividerCount = Math.round(this.dividersElement.offsetWidth / 64);
        var slice = this.calculator.boundarySpan / dividerCount;
        if (!force && this._currentDividerSlice === slice)
            return;

        this._currentDividerSlice = slice;

        this.dividersElement.removeChildren();
        this.dividersLabelBarElement.removeChildren();

        for (var i = 1; i <= dividerCount; ++i) {
            var divider = document.createElement("div");
            divider.className = "resources-divider";
            if (i === dividerCount)
                divider.addStyleClass("last");
            divider.style.left = ((i / dividerCount) * 100) + "%";

            this.dividersElement.appendChild(divider);
        }

        for (var i = 1; i <= dividerCount; ++i) {
            var divider = document.createElement("div");
            divider.className = "resources-divider";
            if (i === dividerCount)
                divider.addStyleClass("last");
            divider.style.left = ((i / dividerCount) * 100) + "%";

            var label = document.createElement("div");
            label.className = "resources-divider-label";
            if (!isNaN(slice))
                label.textContent = this.calculator.formatValue(slice * i);
            divider.appendChild(label);

            this.dividersLabelBarElement.appendChild(divider);
        }
    },

    _updateGraphBars: function()
    {
        if (!this.visible) {
            this.needsRefresh = true;
            return;
        }

        if (document.body.offsetWidth <= 0) {
            // The stylesheet hasn't loaded yet, so we need to update later.
            setTimeout(this._updateGraphBars.bind(this), 0);
            return;
        }

        var dividersElementWidth = this.dividersElement.offsetWidth;
        var resourcesLength = this._resources.length;
        for (var i = 0; i < resourcesLength; ++i) {
            var resourceTreeItem = this._resources[i]._resourcesTreeElement;
            if (!resourceTreeItem)
                continue;
            resourceTreeItem.updateGraphSideWidth(dividersElementWidth);
        }
    },

    _refreshAllResourcesSoon: function(skipBoundaryUpdate, skipSort, immediate)
    {
        if ("_refreshAllResourcesTimeout" in this)
            return;
        this._refreshAllResourcesTimeout = setTimeout(this._refreshAllResources.bind(this), 500, skipBoundaryUpdate, skipSort, immediate);
    },

    _refreshAllResources: function(skipBoundaryUpdate, skipSort, immediate)
    {
        if ("_refreshAllResourcesTimeout" in this) {
            clearTimeout(this._refreshAllResourcesTimeout);
            delete this._refreshAllResourcesTimeout;
        }

        var resourcesLength = this._resources.length;
        for (var i = 0; i < resourcesLength; ++i)
            this.refreshResource(this._resources[i], skipBoundaryUpdate, skipSort, immediate);
    },

    _fadeOutRect: function(ctx, x, y, w, h, a1, a2)
    {
        ctx.save();

        var gradient = ctx.createLinearGradient(x, y, x, y + h);
        gradient.addColorStop(0.0, "rgba(0, 0, 0, " + (1.0 - a1) + ")");
        gradient.addColorStop(0.8, "rgba(0, 0, 0, " + (1.0 - a2) + ")");
        gradient.addColorStop(1.0, "rgba(0, 0, 0, 1.0)");

        ctx.globalCompositeOperation = "destination-out";

        ctx.fillStyle = gradient;
        ctx.fillRect(x, y, w, h);

        ctx.restore();
    },

    _drawSwatch: function(canvas, color)
    {
        var ctx = canvas.getContext("2d");

        function drawSwatchSquare() {
            ctx.fillStyle = color;
            ctx.fillRect(0, 0, 13, 13);

            var gradient = ctx.createLinearGradient(0, 0, 13, 13);
            gradient.addColorStop(0.0, "rgba(255, 255, 255, 0.2)");
            gradient.addColorStop(1.0, "rgba(255, 255, 255, 0.0)");

            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, 13, 13);

            gradient = ctx.createLinearGradient(13, 13, 0, 0);
            gradient.addColorStop(0.0, "rgba(0, 0, 0, 0.2)");
            gradient.addColorStop(1.0, "rgba(0, 0, 0, 0.0)");

            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, 13, 13);

            ctx.strokeStyle = "rgba(0, 0, 0, 0.6)";
            ctx.strokeRect(0.5, 0.5, 12, 12);
        }

        ctx.clearRect(0, 0, 13, 24);

        drawSwatchSquare();

        ctx.save();

        ctx.translate(0, 25);
        ctx.scale(1, -1);

        drawSwatchSquare();

        ctx.restore();

        this._fadeOutRect(ctx, 0, 13, 13, 13, 0.5, 0.0);
    },

    _drawSummaryGraph: function(segments)
    {
        if (!this.summaryGraphElement)
            return;

        if (!segments || !segments.length) {
            segments = [{color: "white", value: 1}];
            this._showingEmptySummaryGraph = true;
        } else
            delete this._showingEmptySummaryGraph;

        // Calculate the total of all segments.
        var total = 0;
        for (var i = 0; i < segments.length; ++i)
            total += segments[i].value;

        // Calculate the percentage of each segment, rounded to the nearest percent.
        var percents = segments.map(function(s) { return Math.max(Math.round(100 * s.value / total), 1) });

        // Calculate the total percentage.
        var percentTotal = 0;
        for (var i = 0; i < percents.length; ++i)
            percentTotal += percents[i];

        // Make sure our percentage total is not greater-than 100, it can be greater
        // if we rounded up for a few segments.
        while (percentTotal > 100) {
            for (var i = 0; i < percents.length && percentTotal > 100; ++i) {
                if (percents[i] > 1) {
                    --percents[i];
                    --percentTotal;
                }
            }
        }

        // Make sure our percentage total is not less-than 100, it can be less
        // if we rounded down for a few segments.
        while (percentTotal < 100) {
            for (var i = 0; i < percents.length && percentTotal < 100; ++i) {
                ++percents[i];
                ++percentTotal;
            }
        }

        var ctx = this.summaryGraphElement.getContext("2d");

        var x = 0;
        var y = 0;
        var w = 450;
        var h = 19;
        var r = (h / 2);

        function drawPillShadow()
        {
            // This draws a line with a shadow that is offset away from the line. The line is stroked
            // twice with different X shadow offsets to give more feathered edges. Later we erase the
            // line with destination-out 100% transparent black, leaving only the shadow. This only
            // works if nothing has been drawn into the canvas yet.

            ctx.beginPath();
            ctx.moveTo(x + 4, y + h - 3 - 0.5);
            ctx.lineTo(x + w - 4, y + h - 3 - 0.5);
            ctx.closePath();

            ctx.save();

            ctx.shadowBlur = 2;
            ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
            ctx.shadowOffsetX = 3;
            ctx.shadowOffsetY = 5;

            ctx.strokeStyle = "white";
            ctx.lineWidth = 1;

            ctx.stroke();

            ctx.shadowOffsetX = -3;

            ctx.stroke();

            ctx.restore();

            ctx.save();

            ctx.globalCompositeOperation = "destination-out";
            ctx.strokeStyle = "rgba(0, 0, 0, 1)";
            ctx.lineWidth = 1;

            ctx.stroke();

            ctx.restore();
        }

        function drawPill()
        {
            // Make a rounded rect path.
            ctx.beginPath();
            ctx.moveTo(x, y + r);
            ctx.lineTo(x, y + h - r);
            ctx.quadraticCurveTo(x, y + h, x + r, y + h);
            ctx.lineTo(x + w - r, y + h);
            ctx.quadraticCurveTo(x + w, y + h, x + w, y + h - r);
            ctx.lineTo(x + w, y + r);
            ctx.quadraticCurveTo(x + w, y, x + w - r, y);
            ctx.lineTo(x + r, y);
            ctx.quadraticCurveTo(x, y, x, y + r);
            ctx.closePath();

            // Clip to the rounded rect path.
            ctx.save();
            ctx.clip();

            // Fill the segments with the associated color.
            var previousSegmentsWidth = 0;
            for (var i = 0; i < segments.length; ++i) {
                var segmentWidth = Math.round(w * percents[i] / 100);
                ctx.fillStyle = segments[i].color;
                ctx.fillRect(x + previousSegmentsWidth, y, segmentWidth, h);
                previousSegmentsWidth += segmentWidth;
            }

            // Draw the segment divider lines.
            ctx.lineWidth = 1;
            for (var i = 1; i < 20; ++i) {
                ctx.beginPath();
                ctx.moveTo(x + (i * Math.round(w / 20)) + 0.5, y);
                ctx.lineTo(x + (i * Math.round(w / 20)) + 0.5, y + h);
                ctx.closePath();

                ctx.strokeStyle = "rgba(0, 0, 0, 0.2)";
                ctx.stroke();

                ctx.beginPath();
                ctx.moveTo(x + (i * Math.round(w / 20)) + 1.5, y);
                ctx.lineTo(x + (i * Math.round(w / 20)) + 1.5, y + h);
                ctx.closePath();

                ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
                ctx.stroke();
            }

            // Draw the pill shading.
            var lightGradient = ctx.createLinearGradient(x, y, x, y + (h / 1.5));
            lightGradient.addColorStop(0.0, "rgba(220, 220, 220, 0.6)");
            lightGradient.addColorStop(0.4, "rgba(220, 220, 220, 0.2)");
            lightGradient.addColorStop(1.0, "rgba(255, 255, 255, 0.0)");

            var darkGradient = ctx.createLinearGradient(x, y + (h / 3), x, y + h);
            darkGradient.addColorStop(0.0, "rgba(0, 0, 0, 0.0)");
            darkGradient.addColorStop(0.8, "rgba(0, 0, 0, 0.2)");
            darkGradient.addColorStop(1.0, "rgba(0, 0, 0, 0.5)");

            ctx.fillStyle = darkGradient;
            ctx.fillRect(x, y, w, h);

            ctx.fillStyle = lightGradient;
            ctx.fillRect(x, y, w, h);

            ctx.restore();
        }

        ctx.clearRect(x, y, w, (h * 2));

        drawPillShadow();
        drawPill();

        ctx.save();

        ctx.translate(0, (h * 2) + 1);
        ctx.scale(1, -1);

        drawPill();

        ctx.restore();

        this._fadeOutRect(ctx, x, y + h + 1, w, h, 0.5, 0.0);
    },

    _updateSummaryGraphSoon: function()
    {
        if ("_updateSummaryGraphTimeout" in this)
            return;
        this._updateSummaryGraphTimeout = setTimeout(this._updateSummaryGraph.bind(this), (this._showingEmptySummaryGraph ? 0 : 500));
    },

    _updateSummaryGraph: function()
    {
        if ("_updateSummaryGraphTimeout" in this) {
            clearTimeout(this._updateSummaryGraphTimeout);
            delete this._updateSummaryGraphTimeout;
        }

        var graphInfo = this.calculator.computeSummaryValues(this._resources);

        var categoryOrder = ["documents", "stylesheets", "images", "scripts", "fonts", "other"];
        var categoryColors = {documents: {r: 47, g: 102, b: 236}, stylesheets: {r: 157, g: 231, b: 119}, images: {r: 164, g: 60, b: 255}, scripts: {r: 255, g: 121, b: 0}, fonts: {r: 231, g: 231, b: 10}, other: {r: 186, g: 186, b: 186}};
        var fillSegments = [];

        this.legendElement.removeChildren();

        if (this.totalLegendLabel)
            this.totalLegendLabel.parentNode.removeChild(this.totalLegendLabel);

        for (var i = 0; i < categoryOrder.length; ++i) {
            var category = categoryOrder[i];
            var size = graphInfo.categoryValues[category];
            if (!size)
                continue;

            var color = categoryColors[category];
            var colorString = "rgb(" + color.r + ", " + color.g + ", " + color.b + ")";

            var fillSegment = {color: colorString, value: size};
            fillSegments.push(fillSegment);

            var legendLabel = this._makeLegendElement(WebInspector.resourceCategories[category].title, this.calculator.formatValue(size), colorString);
            this.legendElement.appendChild(legendLabel);
        }

        if (graphInfo.total) {
            var totalLegendLabel = this._makeLegendElement(WebInspector.UIString("Total"), this.calculator.formatValue(graphInfo.total));
            totalLegendLabel.addStyleClass("total");
            this.legendElement.appendChild(totalLegendLabel);
        }

        this._drawSummaryGraph(fillSegments);
    },

    _updateDividersLabelBarPosition: function()
    {
        var scrollTop = this.containerElement.scrollTop;
        var dividersTop = (scrollTop < this.summaryElement.offsetHeight ? this.summaryElement.offsetHeight : scrollTop);
        this.dividersElement.style.top = scrollTop + "px";
        this.dividersLabelBarElement.style.top = dividersTop + "px";
    },

    _graphSelected: function(treeElement)
    {
        this.closeVisibleResource();
        this.calculator = treeElement.calculator;
        this.containerElement.scrollTop = 0;
    },

    _createResourceView: function(resource)
    {
        if (resource.finished && !resource.failed) {
            switch (resource.category) {
            case WebInspector.resourceCategories.documents:
            case WebInspector.resourceCategories.stylesheets:
            case WebInspector.resourceCategories.scripts:
                return new WebInspector.SourceView(resource);
            case WebInspector.resourceCategories.images:
                return new WebInspector.ImageView(resource);
            case WebInspector.resourceCategories.fonts:
                return new WebInspector.FontView(resource);
            }
        }

        return new WebInspector.ResourceView(resource);
    },

    _startSidebarDragging: function(event)
    {
        WebInspector.elementDragStart(this.sidebarResizeElement, this._sidebarDragging.bind(this), this._endSidebarDragging.bind(this), event, "col-resize");
    },

    _sidebarDragging: function(event)
    {
        this._updateSidebarWidth(event.pageX);

        event.preventDefault();
    },

    _endSidebarDragging: function(event)
    {
        WebInspector.elementDragEnd(event);
    },

    _updateSidebarWidth: function(width)
    {
        if (this.sidebarElement.offsetWidth <= 0) {
            // The stylesheet hasn't loaded yet, so we need to update later.
            setTimeout(this._updateSidebarWidth.bind(this), 0, width);
            return;
        }

        if (!("_currentSidebarWidth" in this))
            this._currentSidebarWidth = this.sidebarElement.offsetWidth;

        if (typeof width === "undefined")
            width = this._currentSidebarWidth;

        width = Number.constrain(width, Preferences.minSidebarWidth, window.innerWidth / 2);

        this._currentSidebarWidth = width;

        if (this.visibleResource) {
            this.containerElement.style.width = width + "px";
            this.sidebarElement.style.removeProperty("width");
        } else {
            this.sidebarElement.style.width = width + "px";
            this.containerElement.style.removeProperty("width");
        }

        this.containerContentElement.style.left = width + "px";
        this.resourceViews.style.left = width + "px";
        this.sidebarResizeElement.style.left = (width - 3) + "px";

        this._updateGraphBars();
        this._updateGraphDividersIfNeeded();
    }
}

WebInspector.ResourcesPanel.prototype.__proto__ = WebInspector.Panel.prototype;

WebInspector.ResourceCalculator = function()
{
}

WebInspector.ResourceCalculator.prototype = {
    computeSummaryValues: function(resources)
    {
        var total = 0;
        var categoryValues = {};

        var resourcesLength = resources.length;
        for (var i = 0; i < resourcesLength; ++i) {
            var resource = resources[i];
            var value = this._value(resource);
            if (typeof value === "undefined")
                continue;
            if (!(resource.category.name in categoryValues))
                categoryValues[resource.category.name] = 0;
            categoryValues[resource.category.name] += value;
            total += value;
        }

        return {categoryValues: categoryValues, total: total};
    },

    computeBarGraphPercentages: function(resource)
    {
        return {start: 0, end: (this._value(resource) / this.boundarySpan) * 100};
    },

    get boundarySpan()
    {
        return this.maximumBoundary - this.minimumBoundary;
    },

    updateBoundries: function(resource)
    {
        this.minimumBoundary = 0;

        var value = this._value(resource);
        if (typeof this.maximumBoundary === "undefined" || value > this.maximumBoundary) {
            this.maximumBoundary = value;
            return true;
        }

        return false;
    },

    reset: function()
    {
        delete this.minimumBoundary;
        delete this.maximumBoundary;
    },

    _value: function(resource)
    {
        return 0;
    },

    formatValue: function(value)
    {
        return value.toString();
    }
}

WebInspector.ResourceTransferTimeCalculator = function()
{
    WebInspector.ResourceCalculator.call(this);
}

WebInspector.ResourceTransferTimeCalculator.prototype = {
    computeSummaryValues: function(resources)
    {
        var resourcesByCategory = {};
        var resourcesLength = resources.length;
        for (var i = 0; i < resourcesLength; ++i) {
            var resource = resources[i];
            if (!(resource.category.name in resourcesByCategory))
                resourcesByCategory[resource.category.name] = [];
            resourcesByCategory[resource.category.name].push(resource);
        }

        var earliestStart;
        var latestEnd;
        var categoryValues = {};
        for (var category in resourcesByCategory) {
            resourcesByCategory[category].sort(WebInspector.Resource.CompareByTime);
            categoryValues[category] = 0;

            var segment = {start: -1, end: -1};

            var categoryResources = resourcesByCategory[category];
            var resourcesLength = categoryResources.length;
            for (var i = 0; i < resourcesLength; ++i) {
                var resource = categoryResources[i];
                if (resource.startTime === -1 || resource.endTime === -1)
                    continue;

                if (typeof earliestStart === "undefined")
                    earliestStart = resource.startTime;
                else
                    earliestStart = Math.min(earliestStart, resource.startTime);

                if (typeof latestEnd === "undefined")
                    latestEnd = resource.endTime;
                else
                    latestEnd = Math.max(latestEnd, resource.endTime);

                if (resource.startTime <= segment.end) {
                    segment.end = Math.max(segment.end, resource.endTime);
                    continue;
                }

                categoryValues[category] += segment.end - segment.start;

                segment.start = resource.startTime;
                segment.end = resource.endTime;
            }

            // Add the last segment
            categoryValues[category] += segment.end - segment.start;
        }

        return {categoryValues: categoryValues, total: latestEnd - earliestStart};
    },

    computeBarGraphPercentages: function(resource)
    {
        if (resource.startTime !== -1)
            var start = ((resource.startTime - this.minimumBoundary) / this.boundarySpan) * 100;
        else
            var start = 100;

        if (resource.endTime !== -1)
            var end = ((resource.endTime - this.minimumBoundary) / this.boundarySpan) * 100;
        else
            var end = 100;

        return {start: start, end: end};
    },

    updateBoundries: function(resource)
    {
        var didChange = false;
        if (resource.startTime !== -1 && (typeof this.minimumBoundary === "undefined" || resource.startTime < this.minimumBoundary)) {
            this.minimumBoundary = resource.startTime;
            didChange = true;
        }

        if (resource.endTime !== -1 && (typeof this.maximumBoundary === "undefined" || resource.endTime > this.maximumBoundary)) {
            this.maximumBoundary = resource.endTime;
            didChange = true;
        }

        return didChange;
    },

    formatValue: function(value)
    {
        return Number.secondsToString(value, WebInspector.UIString.bind(WebInspector));
    }
}

WebInspector.ResourceTransferTimeCalculator.prototype.__proto__ = WebInspector.ResourceCalculator.prototype;

WebInspector.ResourceTransferSizeCalculator = function()
{
    WebInspector.ResourceCalculator.call(this);
}

WebInspector.ResourceTransferSizeCalculator.prototype = {
    _value: function(resource)
    {
        return resource.contentLength;
    },

    formatValue: function(value)
    {
        return Number.bytesToString(value, WebInspector.UIString.bind(WebInspector));
    }
}

WebInspector.ResourceTransferSizeCalculator.prototype.__proto__ = WebInspector.ResourceCalculator.prototype;

WebInspector.ResourceSidebarTreeElement = function(resource)
{
    this.resource = resource;

    WebInspector.SidebarTreeElement.call(this, "resource-sidebar-tree-item", "", "", resource);

    this.refreshTitles();

    this.graphSideElement = document.createElement("div");
    this.graphSideElement.className = "resources-graph-side";

    this.barAreaElement = document.createElement("div");
    this.barAreaElement.className = "resources-graph-bar-area";
    this.graphSideElement.appendChild(this.barAreaElement);

    this.barElement = document.createElement("div");
    this.barElement.className = "resources-graph-bar";
    this.barAreaElement.appendChild(this.barElement);
}

WebInspector.ResourceSidebarTreeElement.prototype = {
    onattach: function()
    {
        WebInspector.SidebarTreeElement.prototype.onattach.call(this);

        this._listItemNode.appendChild(this.graphSideElement);
        this._listItemNode.addStyleClass("resources-category-" + this.resource.category.name);
    },

    onselect: function()
    {
        WebInspector.panels.resources.showResource(this.resource);
    },

    get mainTitle()
    {
        return this.resource.displayName;
    },

    set mainTitle(x)
    {
        // Do nothing.
    },

    get subtitle()
    {
        var subtitle = this.resource.displayDomain;

        if (this.resource.path && this.resource.lastPathComponent) {
            var lastPathComponentIndex = this.resource.path.lastIndexOf("/" + this.resource.lastPathComponent);
            if (lastPathComponentIndex != -1)
                subtitle += this.resource.path.substring(0, lastPathComponentIndex);
        }

        return subtitle;
    },

    set subtitle(x)
    {
        // Do nothing.
    },

    refresh: function()
    {
        this.refreshTitles();

        var newClassName = "sidebar-tree-item resource-sidebar-tree-item resources-category-" + this.resource.category.name;
        if (this._listItemNode && this._listItemNode.className !== newClassName)
            this._listItemNode.className = newClassName;
    },

    updateGraphSideWidth: function(width)
    {
        width += 1; // Add one to account for the sidebar border width.
        this.graphSideElement.style.right = -width + "px";
        this.graphSideElement.style.width = width + "px";
    }
}

WebInspector.ResourceSidebarTreeElement.CompareByTime = function(a, b)
{
    return WebInspector.Resource.CompareByTime(a.resource, b.resource);
}

WebInspector.ResourceSidebarTreeElement.CompareBySize = function(a, b)
{
    return WebInspector.Resource.CompareBySize(a.resource, b.resource);
}

WebInspector.ResourceSidebarTreeElement.CompareByDescendingSize = function(a, b)
{
    return WebInspector.Resource.CompareByDescendingSize(a.resource, b.resource);
}

WebInspector.ResourceSidebarTreeElement.prototype.__proto__ = WebInspector.SidebarTreeElement.prototype;
