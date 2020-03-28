import {Roles, Setups} from '../../creepSetups/setups';
import {DirectivePoisonRoom} from '../../directives/colony/poisonRoom';
import {OverlordPriority} from '../../priorities/priorities_overlords';
import {profile} from '../../profiler/decorator';
import {Tasks} from '../../tasks/Tasks';
import {minBy} from '../../utilities/utils';
import {Zerg} from '../../zerg/Zerg';
import {Overlord} from '../Overlord';

export const MINIMUM_WALL_HITS = 1;

/**
 * Spawn roomPoisoner - upgrqde controller to lvl2, wall in controller then sources.
 */
@profile
export class RoomPoisonerOverlord extends Overlord {

	directive: DirectivePoisonRoom;
	roomPoisoners: Zerg[];

	constructor(directive: DirectivePoisonRoom, priority = OverlordPriority.offense.roomPoisoner) {
		super(directive, 'PoisonRoom', priority);

		this.directive = directive;
		this.roomPoisoners = this.zerg(Roles.roomPoisoner);
	}

	init() {
		if(this.room && this.room.dangerousPlayerHostiles.length == 0) {
			this.wishlist(1, Setups.roomPoisoner);
		}
	}
	
	private handleRoomPoisoner(roomPoisoner: Zerg): void {
		// Recharge from colony room.
		if(roomPoisoner.inSameRoomAs(this.colony) && roomPoisoner.carry.energy == 0) {
			roomPoisoner.task = Tasks.recharge();
			return;
		}
		// Go to Target Room
		if (!roomPoisoner.inSameRoomAs(this.directive)) {
			roomPoisoner.goTo(this.pos, {ensurePath: true, avoidSK: true});
			return;
		}
		// all actions below are done in target directive room
		if(this.room && this.room.controller) {
			// recharge in target room
			if (roomPoisoner.carry.energy == 0) {
				roomPoisoner.task = Tasks.recharge();
				return;
			}

			// upgrade controller to level 2
			if(this.room.controller.level < 2) {
				roomPoisoner.task = Tasks.upgrade(this.room.controller);
				return;
			}

			// fortify walls.hits < MINIMUM_WALL_HITS as a priority
			// Note: do not use cached room.walls
			const walls = this.room!.find(FIND_STRUCTURES, {
									filter: (s: Structure) => s.structureType == STRUCTURE_WALL &&
															s.hits < MINIMUM_WALL_HITS});
			if(walls.length > 0) {
				const wallToFortify = minBy(walls, wall => wall.hits) as StructureWall;
				if(wallToFortify) {
					roomPoisoner.task = Tasks.fortify(wallToFortify);
					return;
				}
			}

			// construct walls
			// Note: directive will take care of managing the csites, so just build on sight!
			// Note: do not use cached room.constructionSites, get a fresh list
			const csites = this.room!.find(FIND_CONSTRUCTION_SITES);
			if(this.room && csites.length > 0) {
				roomPoisoner.task = Tasks.build(_.first(csites));
				return;
			}

			// if nothing to do, then move away from possible csite location if any.
			const fleePositions = _.unique(_.flatten(_.map(_.compact([this.room.controller, ...this.room.sources])
																	  ,obj => obj.pos.neighbors))).filter(pos => pos.isWalkable(true));
			if(fleePositions.length > 0) {
				roomPoisoner.flee(fleePositions,{},{fleeRange:3});
			}
		}
	}
	
	run() {
		this.autoRun(this.roomPoisoners, roomPoisoner => this.handleRoomPoisoner(roomPoisoner));
	}
}
