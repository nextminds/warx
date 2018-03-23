// @flow

import { createSelector } from 'reselect';
import { combineEpics } from 'redux-observable';
import type {PlayerId } from "../types/game";
import { getPlayerById, isSignedIn } from "./module-players";
import type { Store } from "../types/framework";
import { sendAction } from "../socket";
import {toList} from "../shared/helpers";

// local types
// when the current client fires a shot
type BombSetKeyPressedAction = {
    +type: 'BOMB_SET_KEY_PRESSED',
    +origin: 'client',
};

type BombDetonateKeyPress = {
    +type: 'BOMB_DETONATE_KEY_PRESSED',
    +origin: 'client',
};

type BombSetRequestedAction = {
    +type: 'BOMB_SET_REQUESTED',
    +data: {
        +playerId: PlayerId,
    },
    +origin: 'client',
};

type BombSetAction = {
    +type: 'BOMB_SET',
    +data: Bomb,
    +origin: 'server',
};

type BombDetonateRequestedAction = {
    +type: 'BOMB_DETONATE_REQUESTED',
    +data: {
        +id: string,
    },
    +origin: 'client',
};

type BombDetonateAction = {
    +type: 'BOMB_DETONATED',
    +data: {
        +id: string,
    },
    +origin: 'server',
};

type Action = BombSetKeyPressedAction | BombSetRequestedAction | BombSetAction |
    BombDetonateRequestedAction | BombDetonateAction;

export type Bomb = {
    +id: string,
    +playerId: PlayerId,
    +x: number,
    +y: number,
};

export type Bombs = {
    +[id: PlayerId]: Bomb
};

export type BombList = Array<Bomb>;

export type State = {
    +bombs: Bombs,
};

export const initialState: State = {
    bombs: {},
};

// actions

// to be used from the UI
export const bombSetKeyPress = (): BombSetKeyPressedAction => ({
    type: 'BOMB_SET_KEY_PRESSED',
    origin: 'client',
});

export const bombDetonateKeyPress = (): BombDetonateKeyPress => ({
    type: 'BOMB_DETONATE_KEY_PRESSED',
    origin: 'client',
});

export const bombSetRequest = ({ playerId }: { playerId: PlayerId }): BombSetRequestedAction => {
    return {
        type: 'BOMB_SET_REQUESTED',
        data: {
            playerId,
        },
        origin: 'client',
    };
};

export const bombSet = (bomb: Bomb): BombSetAction => ({
    type: 'BOMB_SET',
    data: bomb,
    origin: 'server',
});

export const bombDetonateRequest = ({ id }: { id: string }): BombDetonateRequestedAction => ({
    type: 'BOMB_DETONATE_REQUESTED',
    data: { id },
    origin: 'client',
});

export const bombDetonate = ({ id }: { id: string }): BombDetonateAction => ({
    type: 'BOMB_DETONATED',
    data: { id },
    origin: 'server',
});


export const reducer = (state: State, action: Action): State => {
    const { bombs } = state;
    switch (action.type) {
        case 'BOMB_SET': {
            const { data: bomb } = action;
            console.log('BOMB_SET', action);
            return {
                ...state,
                bombs: {
                    ...bombs,
                    [bomb.id]: bomb,
                }
            }
        }

        case 'BOMB_DETONATED': {
            const { data: { id } } = action;
            const { bombs: { [id]: bombToRemove, ...restBombs } } = state;
            console.log('BOMB_DETONATED', action, state, restBombs);
            return {
                ...state,
                bombs: restBombs
            }
        }
    }

    return state;
};

// selectors
export const getBombs = (state: State) => state.bombs;
export const getBombList = createSelector(
    getBombs,
    (bombs: Bombs): BombList => toList(bombs)
);

// epics
const bombSetRequests = (action$, store: Store) =>
    action$
        .ofType('BOMB_SET_KEY_PRESSED')
        .map(() => {
            // convert the action to something the store understands
            const state = store.getState();
            const currentPlayerId = state.currentPlayerId;
            return bombSetRequest({
                playerId: currentPlayerId,
            })
        })
        .do(action => {
            // tell the server about this client initiated action
            sendAction(action);
        });

const bombSetResponses = (action$, store: Store) =>
    action$
        .ofType('BOMB_SET_REQUESTED')
        // .throttle(() => Observable.interval(store.getState().rules.reloadTime))
        .map((action: BombSetRequestedAction) => {
            // convert the action to something the store understands
            const state = store.getState();
            const playerId = action.data.playerId;
            // todo: player might be null
            const player = getPlayerById(state, playerId);
            return bombSet({
                id: playerId, // todo for now: 1 player 1 bomb
                playerId,
                x: player.x,
                y: player.y,
            })
        });

const bombDetonateRequests = (action$, store: Store) =>
    action$
        .ofType('BOMB_DETONATE_KEY_PRESSED')
        .map(() => {
            // convert the action to something the store understands
            const state = store.getState();
            const currentPlayerId = state.currentPlayerId;
            console.log('BOMB_DETONATE_KEY_PRESSED to bombDetonateRequest', currentPlayerId);
            return bombDetonateRequest({ id: currentPlayerId })
        })
        .do(action => {
            // tell the server about this client initiated action
            sendAction(action);
        });

// todo: move to server
const bombDetonateResponses = (action$, store: Store) =>
    action$
        .ofType('BOMB_DETONATE_REQUESTED')
        .map(action => console.log('BOMB_DETONATE_REQUESTED to bombDetonate', action) || bombDetonate({ id: action.data.id }));

const keyDownActionMap = {
    'b': () => bombSetKeyPress(),
    'n': () => bombDetonateKeyPress(),
};

const keyDownMoves = (action$, store) => action$
    .ofType('KEY_DOWN')
    .filter(({ data: { key } }) => keyDownActionMap[key] && isSignedIn(store.getState()))
    .map(({ data: { key: downKey } }) => keyDownActionMap[downKey]());


export const epic = combineEpics(
    keyDownMoves,
    bombSetRequests,
    bombSetResponses,
    bombDetonateRequests,
    bombDetonateResponses,
);
