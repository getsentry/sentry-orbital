(function(){
    orbital = this;

    var maxLayers = 30;
    var dateKeyFunc = function(){
        return new Date().getMinutes();
    };
    var lastDateKey = null;
    var element = null;
    var layers = [];
    var activeLayer;
    var adjustOffset = 0;
    var targetHeight = 1800;
    var targetWidth = 3600;
    var setHeight;
    var setWidth;
    var currentData = [];
    var lastMessage = null;
    var windowInFocus = true;

    $(window).focus(function() {
        windowInFocus = true;
    });

    $(window).blur(function() {
        windowInFocus = false;
    });

    function sizePageElements() {
        var $geo = $("#geo");
        $geo.css("height", $("body").height() - adjustOffset);
        if ($geo.width() / $geo.height() > 2) {
            orbital.scale = $geo.height() / targetHeight;
        } else {
            orbital.scale = $geo.width() / targetWidth;
        }
        element.css({
            "top": $geo.height() - targetHeight * orbital.scale,
            "left": ($geo.width() - targetWidth * orbital.scale) / 2
        });

        setWidth = element.width();
        setHeight = element.height();

        $('#mapdata').css({
            "-moz-transform": "scale(" + orbital.scale + ")",
            "-webkit-transform": "scale(" + orbital.scale + ")",
            "-ms-transform": "scale(" + orbital.scale + ")",
            "-o-transform": "scale(" + orbital.scale + ")"
        });
        $("canvas").css({
            width: setWidth + "px",
            height: setHeight + "px"
        });
        $("canvas").attr('width', setWidth);
        $("canvas").attr('height', setHeight);
    }

    orbital.stream = null;
    orbital.source = null;

    orbital.getColor = function(data) {
        switch (data.platform) {
            case 'java':
                return [255, 138, 0];
            case 'javascript':
                return [248, 220, 60];
            case 'php':
                return [95, 129, 186];
            case 'python':
                return [55, 118, 171];
            case 'ruby':
                return [217, 19, 4];
            default:
                return [255, 255, 255];
        }
    }

    orbital.addData = function(data) {
        var x = ~~((parseFloat(data.lng) + 180) * 10) * orbital.scale,
            y = ~~((-parseFloat(data.lat) + 90) * 10) * orbital.scale;

        var color = orbital.getColor(data);

        // render and animate our point
        var point = jc.circle(x, y,
            5, "rgba(" + color[0] + ", " + color[1] + ", " + color[2] + ", 1)", 1)
          .animate({radius:1, opacity:0.4}, 300, function(){
              point.del();
              activeLayer.fillStyle = "rgba(" + color[0] + ", " + color[1] + ", " + color[2] + ", 0.2)";
              activeLayer.beginPath();
              activeLayer.arc(x, y, 1, 0, Math.PI * 2, false);
              activeLayer.fill();
          });
    };

    orbital.connect = function(){
        orbital.disconnect();

        orbital.source = new EventSource(orbital.stream);
        orbital.source.onopen = function(e) {
          console.log('[Stream] Connection opened to ' + orbital.stream);
        };

        orbital.source.onmessage = function(e){
            if (windowInFocus) {
                var data = JSON.parse(e.data);
                orbital.addData({
                    lat: data[0],
                    lng: data[1],
                    ts: data[2],
                    platform: data[3]
                });
            }
        };

    };

    orbital.disconnect = function(){
        if (orbital.source) {
            console.log('[Stream] Closing connection to ' + orbital.stream);
            orbital.source.onclose = function(){};
            orbital.source.close();
            orbital.source = null;
        }
    };

    orbital.createLayer = function(dateKey){
        var layer = $('<canvas data-date-key="' + dateKey + '"></canvas>').css({
            width: setWidth + 'px',
            height: setHeight + 'px'
        }).attr({
            width: setWidth,
            height: setHeight
        });
        element.append(layer);
        layers.push(layer);

        return layer;
    };

    orbital.watchActiveLayer = function() {
        dateKey = dateKeyFunc();

        if (dateKey == lastDateKey) {
            setTimeout(orbital.watchActiveLayer, 3000);
            return;
        }

        lastDateKey = dateKey;

        // create a new layer
        layer = orbital.createLayer(dateKey);

        // set the new layer as the active layer
        activeLayer = layer[0].getContext("2d");

        // remove excess layers
        var excess = layers.slice(maxLayers, layers.length);
        orbital.layers = layers.slice(0, maxLayers);
        for (var i=0; i<excess.length; i++) {
            console.log('Removing layer ( ' + excess[i].attr('data-date-key') + ' )');
            excess[i].remove();
        }

        setTimeout(orbital.watchActiveLayer, 3000);
    };

    orbital.init = function(el) {
        element = el;

        orbital.stream = '/stream';

        sizePageElements();

        jc.start('pings', true);

        orbital.watchActiveLayer();

        window.onbeforeunload = function() {
            orbital.disconnect();
        };

        orbital.connect();
    };
})();
