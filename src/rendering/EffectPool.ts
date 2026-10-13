import Phaser from 'phaser';
type Particle={image:Phaser.GameObjects.Image;x:number;y:number;vx:number;vy:number;age:number;life:number;alpha:number};
type Label={text:Phaser.GameObjects.Text;x:number;y:number;age:number;life:number};
/** Hard bounds, no new Game Objects/Tweens on attack, landing or dash. */
export class EffectPool{
  private dots:Particle[]=[];
  private ghosts:Particle[]=[];
  private labels:Label[]=[];
  private dotCursor=0;private ghostCursor=0;private labelCursor=0;
  constructor(scene:Phaser.Scene){
    for(let i=0;i<64;i++)this.dots.push(this.particle(scene.add.image(0,0,'fx-dot').setDepth(15)));
    for(let i=0;i<8;i++)this.ghosts.push(this.particle(scene.add.image(0,0,'fx-dot').setDepth(9)));
    for(let i=0;i<8;i++)this.labels.push({text:scene.add.text(0,0,'',{fontFamily:'Arial, sans-serif',fontSize:'15px',fontStyle:'bold',color:'#f3d596',stroke:'#12323a',strokeThickness:3}).setOrigin(.5).setDepth(20).setVisible(false),x:0,y:0,age:1,life:0});
  }
  private particle(image:Phaser.GameObjects.Image):Particle{return{image:image.setVisible(false),x:0,y:0,vx:0,vy:0,age:1,life:0,alpha:1};}
  ghost(sprite:Phaser.GameObjects.Sprite,worldY:number){
    const p=this.ghosts[this.ghostCursor++%this.ghosts.length]!;
    Object.assign(p,{x:sprite.x,y:worldY,vx:0,vy:0,age:0,life:.19,alpha:.28});
    p.image.setTexture(sprite.texture.key,sprite.frame.name).setOrigin(sprite.originX,sprite.originY).setDisplaySize(sprite.displayWidth,sprite.displayHeight).setFlipX(sprite.flipX).setRotation(sprite.rotation).setTint(0xd2e9d4).setPosition(sprite.x,sprite.y).setAlpha(.28).setVisible(true);
  }
  burst(x:number,y:number,color:number){for(let i=0;i<8;i++){
    const p=this.dots[this.dotCursor++%this.dots.length]!;
    Object.assign(p,{x,y,vx:Math.cos(i*.79)*95,vy:Math.sin(i*.79)*72,age:0,life:.31,alpha:1});
    p.image.setTexture('fx-dot').setOrigin(.5).setScale(.18+i%3*.08).setTint(color).setAlpha(1).setRotation(0).setVisible(true);
  }}
  floating(x:number,y:number,label:string,color='#f3d596'){
    const p=this.labels[this.labelCursor++%this.labels.length]!;Object.assign(p,{x,y,age:0,life:.65});p.text.setText(label).setColor(color).setAlpha(1).setVisible(true);
  }
  update(dt:number,cameraY:number){
    for(const group of [this.dots,this.ghosts])for(const p of group){if(p.age>=p.life)continue;p.age+=dt;if(p.age>=p.life){p.image.setVisible(false);continue;}p.x+=p.vx*dt;p.y+=p.vy*dt;p.image.setPosition(p.x,p.y-cameraY).setAlpha(p.alpha*(1-p.age/p.life));}
    for(const p of this.labels){if(p.age>=p.life)continue;p.age+=dt;if(p.age>=p.life){p.text.setVisible(false);continue;}p.text.setPosition(p.x,p.y-cameraY-p.age*58).setAlpha(1-p.age/p.life);}
  }
}
