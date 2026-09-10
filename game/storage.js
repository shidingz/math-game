(() => {
  const isTest=new URLSearchParams(window.location.search).get('test')==='1';
  const KEY=isTest?'math-pet-game:test:v1':'math-pet-game:v2',LEGACY='math-pet-game:v1';let warning='';
  const fresh=()=>isTest?MathPetTestTools.createState(MathPetCharacters.list()):MathPetCore.initialState();
  window.MathPetStorage={key:KEY,isTest,get warning(){return warning;},
    load(){try{
      const text=localStorage.getItem(KEY)||(!isTest&&localStorage.getItem(LEGACY));if(!text)return fresh();
      const state=MathPetCore.restore(JSON.parse(text));
      // Only add newly introduced characters to an older test save. Keep deliberate test locks.
      if(isTest)for(const c of MathPetCharacters.list())if(!Object.hasOwn(state.pets,c.id)){state.pets[c.id]={level:1,growth:0,feeds:0};state.unlockedPets[c.id]=true;}
      return state;
    }catch(e){warning='本机存档暂时不可用，这次仍然可以玩。';return fresh();}},
    save(state){try{localStorage.setItem(KEY,JSON.stringify(state));return true;}catch(e){warning='进度暂未保存，请不要关闭这个页面。';return false;}}
  };
})();
