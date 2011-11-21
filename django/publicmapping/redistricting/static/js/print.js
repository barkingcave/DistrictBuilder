/*
   Copyright 2011 Micah Altman, Michael McDonald

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.

   This file is part of The Public Mapping Project
   https://github.com/PublicMapping/

   Purpose:
       This script file defines behaviors of the 'Choose Plan' dialog.
   
   Author: 
        Andrew Jennings, David Zwarg
*/

/**
 * Create a jQuery compatible object that contains functionality for
 * printing the current map view.
 *
 * Parameters:
 *   options -- Configuration options for the print layout.
 */
printplan = function(options) {

    var _self = {},
        _options = $.extend({
            plan: 0,
            target: document.body,
            map: null,
            height: 500,
            width: 1024
        }, options);

    /**
     * Initialize the print button. Setup the click event for the target to
     * show the print page.
     *
     * Returns:
     *   The print button.
     */
    _self.init = function() {
        var _init = function(evt, map) {
            _options.target.click(_self.doprint);

            _options.map = map;
            _options.districtLayer = map.getLayersByName('Current Plan')[0];
        };

        $(document.body).bind('mapready',_init);

        $(_options.target).button({icons: {primary:'ui-icon'}});

        return _self;
    };

    _self.doprint = function() {
        var geolevel = null,
            disturl = '',
            geogurl = '',
            osmurl = 'http://staticmap.openstreetmap.de/staticmap.php?maptype=mapnik', // needs center, zoom, size
            legendurl1 = '',
            legendurl2 = '',
            sz = _options.map.getExtent(),
            cen = sz.getCenterLonLat(),
            sz_array = sz.toArray(),
            zoom = 0,
            res = 1,
            params = null,
            uStyle = null,
            sld = null,
            fmt = new OpenLayers.Format.SLD();
        $.each(_options.map.getLayersBy('CLASS_NAME','OpenLayers.Layer.WMS'),function(idx, item){
            if (item.getVisibility()) {
                geolevel = item;
            }
        });
        // pad out dimensions to keep from distorting result map
        if (sz.getWidth()/sz.getHeight() < _options.width/_options.height) {
            // sz_array height needs to be smaller
            var new_h = sz.getWidth() * _options.height / _options.width;
            sz_array[1] = cen.lat - new_h / 2.0;
            sz_array[3] = cen.lat + new_h / 2.0;
        }
        else if (sz.getWidth()/sz.getHeight() > _options.width/_options.height) {
            // sz_array width needs to be smaller
            var new_w = sz.getHeight() * _options.width / _options.height;
            sz_array[0] = cen.lon - new_w / 2.0;
            sz_array[2] = cen.lon + new_w / 2.0;
        }
        params = OpenLayers.Util.extend({}, geolevel.params);
        params.TILES = null;
        params.TILESORIGIN = null;
        params.HEIGHT = _options.height;
        params.WIDTH = _options.width;
        params.BBOX = sz_array.join(',');
        geogurl = geolevel.getFullRequestString(params).replace(new RegExp('gwc/service/'),'');

        //console.log(geogurl);
        lyr = params.LAYERS;

        params.LAYERS = null;
        disturl = geolevel.getFullRequestString(params).replace(new RegExp('gwc/service/'),'');

        //console.log(disturl);

        params.REQUEST = 'GetLegendGraphic';
        params.WIDTH = '20';
        params.HEIGHT = '20';
        params.BBOX = null;
        params.SRS = null;
        params.STYLES = null;
        params.TRANSPARENT = null;
        params.VERSION = '1.0.0';
        params.LAYER = lyr;
        params.FORMAT = 'image/jpeg';
        legendurl1 = geolevel.getFullRequestString(params).replace(new RegExp('gwc/service/'),'');

        //console.log(legendurl1);

        var proj = _options.map.projection;
        if (proj.projCode == 'EPSG:3785') {
            proj = new OpenLayers.Projection('EPSG:900913');
        }
        cen.transform(proj,new OpenLayers.Projection('EPSG:4326'));
        while (_options.map.getResolution() * res < 156543.0339) {
            zoom++;
            res *= 2;
        }
        osmurl += '&center=' + cen.lat + ',' + cen.lon
        osmurl += '&zoom=' + zoom;
        osmurl += '&size=' + _options.width + 'x' + _options.height;

        //console.log(osmurl);

        var lyr = null;
        var lyrRE = new RegExp('^(.*):demo_(.*)_.*$');
        $.each(_options.map.getLayersBy('visibility',true),function(idx, item){
            if (lyrRE.test(item.name)) {
                lyr = RegExp.$1 + ':simple_district_' + RegExp.$2;
            }
        });

        uStyle = OpenLayers.Util.extend({},_options.districtLayer.styleMap.styles['default']);
        uStyle.layerName = _options.districtLayer.name;
        var mapRules = [];
        var legendRules = [];
        var labeled = false;
        $.each(uStyle.rules, function(ridx, ruleItem){
            var fids = [];
            $.each(_options.districtLayer.features, function(fidx, featureItem) {
                if (ruleItem.evaluate(featureItem)) {
                    fids.push(featureItem.fid);
                }
                if (!labeled) {
                    var lblFilter = new OpenLayers.Filter.Comparison({
                        type: OpenLayers.Filter.Comparison.EQUAL_TO,
                        property: 'id',
                        value: featureItem.fid
                    });
                    var defStyle = featureItem.layer.styleMap.styles['default'].defaultStyle,
                        ffam = defStyle.fontFamily,
                        fwht = defStyle.fontWeight,
                        fsz = defStyle.fontSize,
                        fclr = defStyle.fontColor;
                    // process the font stuff a little
                    ffam = ffam.split(',')[0];
                    fwht = (fwht > 100) ? 'bold' : 'normal';
                    fsz = new RegExp('.*pt$').test(fsz) ? convertPtToPx(fsz) : fsz;
                    var lblRule = new OpenLayers.Rule({
                        filter: lblFilter,
                        symbolizer: { Text: new OpenLayers.Symbolizer.Text({
                            label:featureItem.attributes.name,
                            fontFamily: ffam,
                            fontWeight: fwht,
                            fontSize: fsz,
                            fillColor: fclr,
                            fillOpacity: 1.0
                        })}
                    });
                    mapRules.push(lblRule);
                }
            });
            labeled = true;
            if (fids.length > 0) {
                var myStyle = { Polygon: OpenLayers.Util.extend({}, uStyle.defaultStyle) },
                    subFilters = [],
                    myRule = null;
                myStyle = OpenLayers.Util.extend(myStyle, ruleItem.symbolizer);
                for (var i = 0; i < fids.length; i++) {
                    subFilters.push( new OpenLayers.Filter.Comparison({
                        type: OpenLayers.Filter.Comparison.EQUAL_TO,
                        property: 'id',
                        value: fids[i]
                    }));
                }
                myRule = new OpenLayers.Rule({
                    title: ruleItem.title,
                    filter: new OpenLayers.Filter.Logical({
                        type: OpenLayers.Filter.Logical.OR,
                        filters: subFilters
                    }),
                    symbolizer: myStyle
                });
                mapRules.push(myRule);
                if (ruleItem.title !== null && ruleItem.title !='') {
                    legendRules.push(myRule);
                }
            }
        });
        uStyle.rules = legendRules;
        delete uStyle.defaultStyle;

        sld = { namedLayers: {}, version: '1.0.0' };
        sld.namedLayers[lyr] = {
            name: lyr,
            userStyles: [ uStyle ],
            namedStyles: []
        };

        params.SLD_BODY = fmt.write(sld);
        params.LAYER = lyr;
        legendurl2 = geolevel.getFullRequestString(params).replace(new RegExp('gwc/service/'),'');

        //console.log(legendurl2);

        var x = Sha1.hash(new Date().toString());

        uStyle.rules = mapRules;
        sld = { namedLayers: {}, version: '1.0.0' };
        sld.namedLayers[lyr] = {
            name: lyr,
            userStyles: [ uStyle ],
            namedStyles: []
        };

        $(document.body).append('<form id="printForm" method="POST" action="../print/?x='+x+'">' +
            '<input type="hidden" name="csrfmiddlewaretoken" value="' + $('#csrfmiddlewaretoken').val() + '"/>' +
            '<input type="hidden" name="height" value="' + _options.height + '"/>' +
            '<input type="hidden" name="width" value="' + _options.width + '"/>' +
            '<input type="hidden" name="basemap" value="' + osmurl + '"/>' +
            '<input type="hidden" name="geography" value="' + geogurl + '"/>' +
            '<input type="hidden" name="districts" value="' + disturl + '"/>' +
            '<input type="hidden" name="legend1" value="' + legendurl1 + '"/>' +
            '<input type="hidden" name="legend2" value="' + legendurl2 + '"/>' +
            '<textarea name="sld" style="display:none;">' + fmt.write(sld) + '</textarea>' +
            '</form>');

        $('#printForm').submit();
    };

    var convertPtToPx = function(str) {
        var pts = parseInt(str,10), px = 0;
        pts -= 6;
        px = pts / 0.75;
        px += 8;
        return px.toFixed(1);
    };

    return _self;
};

