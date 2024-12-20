async function loadShader(url) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Fehler beim Laden von ${url}: ${response.statusText}`);
    }
    return response.text(); // Shader als Text zurückgeben
}


function createStockRectangles(dataPoints, rectWidth) {
    const vertices = []
    const indices = []
    const colors = []
    const pointIndices = []

    for (let i = 1; i < dataPoints.length; i++) {
        const prevY = dataPoints[i - 1].price;
        const currentY = dataPoints[i].price;
        const x = (i - 1) * rectWidth;
        const halfWidth = rectWidth * 0.5
        // Punkte für Triangle Strip: P1, P2, P3, P4
        vertices.push(
            x-halfWidth, prevY,                  // P1: Unten links
            x-halfWidth, currentY,               // P2: Oben links
            x+halfWidth, prevY,      // P3: Unten rechts
            x+halfWidth, currentY    // P4: Oben rechts
        );
        for (let h = 0; h < 4; h++) {
            pointIndices.push(i-1)
        }
        indices.push(4*(i - 1)+0); 
        indices.push(4*(i - 1)+1); 
        indices.push(4*(i - 1)+2); 
        indices.push(4*(i - 1)+1); 
        indices.push(4*(i - 1)+2); 
        indices.push(4*(i - 1)+3); 
        

        // Bestimme die Farbe: Grün (Aufwärts) oder Rot (Abwärts)
        const color = currentY < prevY 
            ? [1.0, 0.0, 0.0, 1.0] // Rot (RGBA: 1, 0, 0, 1)
            : [0.0, 1.0, 0.0, 1.0]; // Grün (RGBA: 0, 1, 0, 1)

        for (let j = 0; j < 4; j++) {
            colors.push(...color);
        }
    }

    return { vertices: new Float32Array(vertices), indices: new Int32Array(indices), colors: colors, pointIndices: new Float32Array(pointIndices) };

}
function updateGraph(graph, app, parsedData, currentIndexInteger, maxVisiblePoints, stepX, isFinalScreen, coins, fiatName) {
    let maxPrice = parsedData[currentIndexInteger].price
    let minPrice = parsedData[currentIndexInteger].price
    const price = parsedData[currentIndexInteger].price
    for (let i = currentIndexInteger-maxVisiblePoints+1; i < currentIndexInteger; i++) {
        if (i > 0) {
            maxPrice = Math.max(maxPrice, parsedData[i].price)
            minPrice = Math.min(minPrice, parsedData[i].price)
        }
    }

    if (maxPrice === minPrice) {
        maxPrice=Math.max(100, parsedData[currentIndexInteger].price*2)
        minPrice=0
    }
    var scaleY = -app.renderer.height*0.8/(maxPrice-minPrice)
    graph.curve.position.set(- (currentIndexInteger-maxVisiblePoints+1)*stepX, app.renderer.height*0.9-minPrice*scaleY);
    graph.curve.scale.set(stepX, scaleY);
    graph.curve.shader.resources.graphUniforms.uniforms.uCurrentIndex = currentIndexInteger
    graph.curve.shader.resources.graphUniforms.uniforms.uMaxVisiblePoints = maxVisiblePoints
    graph.logo.x = (currentIndexInteger - (currentIndexInteger-maxVisiblePoints+2)) * stepX;
    graph.logo.y = app.renderer.height*0.9-(price-minPrice)/(maxPrice-minPrice)*app.renderer.height*0.8;
    graph.logoSprite.height = graph.logoSprite.width = app.renderer.width*0.04


    if (!isFinalScreen) {
        graph.priceLabel.x =  (currentIndexInteger - (currentIndexInteger-maxVisiblePoints+2)) * stepX;
        graph.priceLabel.y = app.renderer.height*0.9-  (price-minPrice)/(maxPrice-minPrice)*app.renderer.height*0.8;
        graph.priceLabel.text = formatCurrency(price, fiatName,null, true) 
        graph.priceLabel.alpha = 1
        graph.priceLabel.y = Math.min(app.renderer.height-graph.priceLabel.height*(1-graph.priceLabel.anchor.y), Math.max(graph.priceLabel.y, graph.priceLabel.height*graph.priceLabel.anchor.y))
        graph.priceLabel.x = Math.min(app.renderer.width-graph.priceLabel.width*(1-graph.priceLabel.anchor.x), Math.max(graph.priceLabel.x, -graph.priceLabel.width*(graph.priceLabel.anchor.x)))
    } else {
        graph.priceLabel.alpha = 0
    }

}

function createGraph(parsedData, graphVertexShader, graphFragmentShader, coinName, coins, textStyle) {


    let rects = createStockRectangles(parsedData,1)

    const geometry = new PIXI.Geometry({
        attributes: {
            aPosition: rects.vertices,
            aColor: rects.colors,
            aIndex: rects.pointIndices
        },
        indexBuffer: rects.indices
    });

    const shader = new PIXI.Shader({
        glProgram: new PIXI.GlProgram({ 
            vertex: graphVertexShader, 
            fragment: graphFragmentShader, 
            }),
        resources: {
            graphUniforms: {
                uCurrentIndex: {type: 'i32', value: 0},
                uMaxVisiblePoints: {type: 'i32', value: 3},
                uScale: { value: [1.0, 1.0], type: 'vec2<f32>' },
            }
        }
    });

    const graph = new PIXI.Container()

    const graphMesh = new PIXI.Mesh({
        geometry,
        shader
    });


    const logo = new PIXI.Container()
    const logoSprite = new PIXI.Sprite(coins[coinName].texture);
    logo.addChild(logoSprite)
    logoSprite.anchor.set(0.5,0.5)
    logoSprite.scale.set(0.001,0.001)        

    graphMesh.state.culling = false;
    graph.addChild(graphMesh)
    graph.addChild(logo);
    graph.curve = graphMesh
    graph.logo = logo
    graph.logoSprite = logoSprite


    const priceLabel = new PIXI.Text("", textStyle);
    graph.addChild(priceLabel);
    graph.priceLabel = priceLabel
    graph.priceLabel.anchor.set(0,1.5)

    return graph
}

const test = new Float32Array([
    0,0,
    100, 400,
    200, 500, 
    300, 100,  
    400, 250 
])



function createBackground(vertexShader, fragmentShader)  {

    var geometry = new PIXI.Geometry({
        attributes: {
            aPosition:  new Float32Array([
                -1, -1, // Linke untere Ecke
                 1, -1, // Rechte untere Ecke
                -1,  1, // Linke obere Ecke
                 1,  1  // Rechte obere Ecke
            ])
        },
        topology: 'triangle-strip'
    });

    const shader = new PIXI.Shader({
        glProgram: new PIXI.GlProgram({ 
            vertex: vertexShader, 
            fragment: fragmentShader, 
            }),
        resources: {
            backgroundUniforms: {
                uMode: {type: 'i32', value: 1},
                uThreshold: {type: 'f32', value: 0.05},
                uTime: {type: 'f32', value: 0.0},
                uCurveStrength: {type: 'f32', value: 1.5},
            }
        }
    });

    const graph = new PIXI.Mesh({
        geometry,
        shader
    });
    return graph
}
         