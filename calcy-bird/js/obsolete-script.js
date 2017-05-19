var Line = function(params,derivatives,integrals){
    var obj = {
        pairs: [],
        color: '#ff0000',
        name: 'line',
        dx: (derivatives > 0) ? new Line({name:'d'+(params['name'] || 'line')},derivatives - 1,0) : false,
        int: (integrals > 0) ? new Line({name:'int-'+(params['name'] || 'line')},0,integrals - 1) : false,
        add: function(x,y){
            //include derivative
            if(this.dx)
                this.dx.add(x,y - this.getValue());
            
            //include Integral
            if(this.int)
                this.int.add(x,y + this.int.getValue());
            
            this.pairs.push([x,y]);
            if(y < this.yMin)
                this.yMin = y;
            if(y > this.yMax)
                this.yMax = y;
                
            return this;
        },
        setValue: function(dx,y){
            return this.add(this.getValue(true) + dx, y);
        },
        increment: function(dx,dy){
            if(dy.constructor === this.constructor)
                dy = dy.getValue();
            return this.add(this.getValue(true) + dx, this.getValue() + dy);
        },
        getValue: function(returnX){
            //default returns Y
            if(this.pairs.length === 0)
                return 0; //if there are no values
            return this.pairs[this.pairs.length - 1][returnX ? 0 : 1];
        },
        draw: function(ctx){
            ctx.beginPath();
            
            ctx.strokeStyle = this.color;
            
            function adjustToScreen(value,that){
                //return the position that it should be on the screen
                return (value - that.yMin) / that.yMax * ctx.canvas.height;
            }
            
            if(this.pairs[0])
                ctx.moveTo(this.pairs[0][0],adjustToScreen(this.pairs[0][1],this));
            
            this.pairs.every(function(pair){
                return !ctx.lineTo(pair[0],adjustToScreen(pair[1],this));
            },this);
            ctx.stroke();
            ctx.closePath();
            
            return this;
        },
        printStatus: function(isChild){
            var str = this.name+":"+this.getValue();
            if(this.dx)  str += ', '+ this.dx.printStatus(true);
            if(this.int) str += ', '+this.int.printStatus(true);
            
            if(isChild)
                return str;
            console.log(str);
            return this;
        },
        yMin: 0,
        yMax: 0,
    };
    for(var param in params){
        obj[param] = params[param];
    }
    return obj;
};

function startGame(){
    var canvas = $('#game'),
        context = canvas[0].getContext('2d'),
        slider = $('#slider');

    var time=0,timeDelay,dx,
        birdPath = new Line({color: 'red'},0,2),
        keys = {
            pressed: (function(){
                //set up key listeners
                window.onkeyup = function(e) {
                    keys.pressed[e.keyCode]=false;
                    console.log(e.keyCode,"was released");
                }
                window.onkeydown = function(e) {
                    keys.pressed[e.keyCode]=true;
                    console.log(e.keyCode,'was pressed');
                }
                
                return [];
            })(),
            isPressed: function(code){
                return !!keys.pressed[code];
            }
        },
        gameRunning = true;
    
    slider.attr('min',-6).attr('max',6).attr('value',0);
    timeDelay=75;
    dx=1;
    birdPath.add(0,0);
    
    function gameLoop(){
        
        birdPath.setValue(dx,slider.val());
        
        /*
        if(keys.isPressed(38))
            birdPath.setValue(dx,1);
        else if(keys.isPressed(40))
            birdPath.setValue(dx,-1);
        else
            birdPath.setValue(dx, 0);
        */
        
        birdPath.printStatus()
        console.log("time:",time);
        
        context.clearRect(0, 0, canvas[0].width, canvas[0].height);
        
        birdPath.draw(context);
        birdPath.int.draw(context);
        birdPath.int.int.draw(context);
        
        if(time > 500)
            gameRunning = false;
        
        time++;
        if(gameRunning)
            setTimeout(gameLoop,timeDelay);
    }
    
    gameLoop();
}