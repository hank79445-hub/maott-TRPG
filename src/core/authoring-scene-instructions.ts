export const authoringSceneInstructions = `场景魔法与补给使用可选scenes[].effectSetup，三种入口ZIP、纯文本、API采用同一schema。它是GM预置剧本事实，不是玩家已施法／已扣资源记录；开团由GM确认。不得写castId、clockSourceId、待结算、运行历史或可执行脚本。
regions数组字段：id为本场景稳定局部编号，spellId为目录内M4持续区域或mundane-light；geometry为shape(sphere/cylinder/cube/square/emanation/line/wall)、x/y(格)、height(绝对尺)、size/width/heightFeet(尺)、angle、originSpan，墙另写points连续真实地面坐标。slotLevel、dc、hidden、remainingHours、note由GM预置；未写remainingHours采用规则最长剩余期限；永久效果及物理结果另计，不假造实战专注。瞬间造水/造粮/敲击不能当活动区域，初始结果写容器内容和真实门锁状态。
objectId引用同场景spatialSetup.objects[].id；pointId引用同场景points[].key；sourceNpcId及magic.excludedIds引用npcs[].key，程序生成正式ID。随身风／灵卫／小屋／兽群须实际NPC来源，未出场者不提前激活。magic结构见schema：警报、魔嘴、爆炸符文须有trigger(kind/range/sense/types/description)，魔嘴须message原文及wordCountConfirmed=true；口令和触发细节只供GM，绝不写进art、appearance、生图包或公开广播。初始储法符文不允许伪造已支付配方，开团后选真实来源布设。terrain用supportIds引用真实植物／支撑物件，plantCells与excludedCells用x,y格字符串，webSupport明确opposing/surface/unsupported；不能凭图片猜测支撑或在全场虚构植物。
普通物件灯填light={bright,dimExtra,sunlight,magical,flame?,protected?,color}；装饰绘画中的灯不是逻辑光源。空间照度继续spatialSetup.light；室外／室内／混合以及不自动外围围墙约定不变。
containers数组：id、objectId、name、open、hidden、waterCapacity、foodCapacity、water、food。必须引用真实空间容器，内容不得超容量。水按液体盎司（128=1加仑），食物按重量盎司（16=1磅），均为整数，二者为明确分隔的容量。water/food为已有实物，不自动扣法术位或产生玩家资源。
materials数组：id、npcId(npcs[].key)、consumableId(该NPC.consumables[].key)、kind(ruby-dust/gold-dust/jade-dust/diamond-dust/silver-salt)、valueGP。必须对应NPC真实单件消耗品，不能只有金币数字或说明；完整职业卡NPC的实际角色背包材料由GM开团后登记。缺必要引用应报错，不能悄悄省略。`
export const authoringSceneExample = {
  spatialSetup: {
    floorHeight: 0,
    light: 'dim',
    openSky: true,
    objects: [
      {
        id: 'water-tank',
        name: '石水槽',
        kind: 'object',
        x: 3,
        y: 3,
        height: 0,
        width: 5,
        heightFeet: 3,
        depth: 5,
        weight: 100,
        loose: false,
        enabled: true,
        hidden: false,
      },
    ],
  },
  effectSetup: {
    regions: [
      {
        id: 'camp-lamp',
        spellId: 'mundane-light',
        geometry: {
          shape: 'sphere',
          x: 4,
          y: 3,
          height: 3,
          size: 40,
          heightFeet: 0,
          width: 5,
          angle: 0,
          originSpan: 1,
        },
        slotLevel: 0,
        hidden: false,
        light: {
          bright: 20,
          dimExtra: 20,
          sunlight: false,
          magical: false,
          flame: true,
          protected: false,
          color: '#e8bf77',
        },
        note: 'GM确认真实营灯，不将材质美术当规则',
      },
    ],
    containers: [
      {
        id: 'tank-content',
        objectId: 'water-tank',
        name: '石水槽',
        waterCapacity: 1280,
        foodCapacity: 0,
        open: true,
        hidden: false,
        water: 640,
        food: 0,
      },
    ],
    materials: [],
  },
}
