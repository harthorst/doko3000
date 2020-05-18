// globally used player_id
let player_id = ''
// for staying in sync with the game this is global
let turn_count = 0
// keep an eye on next player to know if turns are allowed or not
let current_player_id = ''
// lock dragging of cards while waiting for trick being claimed
let cards_locked = false

$(document).ready(function () {
    const socket = io()

    // initialize drag&drop
    let dragging = dragula([document.querySelector('#hand'),
        document.querySelector('#table'), {
            revertOnSpill: true,
            direction: 'horizontal'
        }
    ]);

    dragging.on('drop', function (card, target, source) {
        // do not drag your gained tricks around
        console.log(card, source, target, cards_locked)
        if (card.id == 'cards_stack') {
            dragging.cancel(true)
        } else if (source.id == 'hand' && target.id == 'table' && player_id == current_player_id && !cards_locked) {
            console.log(card.id == 'cards_stack')
            $('#table').append(card)
            // add tooltip
            $(card).attr('title', player_id)
            socket.emit('played-card', {
                player_id: player_id,
                card_id: $(card).data('id'),
                card_name: $(card).data('name'),
                table_id: $(card).data('table_id')
            })
        } else if (source.id == 'hand' && target.id == 'hand') {
            return true
        } else if (source.id == 'table' || cards_locked || player_id != current_player_id) {
            dragging.cancel(true)
        }
    })

    socket.on('connect', function () {
        // revalidate user ID
        socket.emit('who-am-i')
    })

    socket.on('you-are-what-you-is', function (msg) {
        if (player_id == '') {
            player_id = msg.player_id
        }
        if (current_player_id == '') {
            current_player_id = msg.current_player_id
        }
        if (msg.round_finished) {
            socket.emit('need-final-result', {
                player_id: player_id,
                table_id: msg.table_id
            })
        }
    })

    socket.on('new-table-available', function (msg) {
        $('#list_tables').html(msg.html)
    })

    socket.on('played-card-by-user', function (msg) {
        current_player_id = msg.current_player_id
        console.log(msg)
        //$('#hud_players').html('')
        $('#hud_players').html(msg.html.hud_players)
        $('.overlay-button').addClass('d-none')

        // $('.hud_player').removeClass('hud-player-active')
        // if (!msg.is_last_turn) {
        //     $('#hud_player_' + msg.current_player_id).addClass('hud-player-active')
        // }
        if (player_id != msg.player_id) {
            $('#table').append(msg.html.card)
            $('#card_' + msg.card_id).attr('title', msg.player_id)
        }
        if (msg.is_last_turn) {
            cards_locked = true
            $('#turn_indicator').addClass('d-none')
            console.log(msg.idle_players.includes(player_id))
            if (!msg.idle_players.includes(player_id)) {
                $('#button_claim_trick').removeClass('d-none')
            }
        } else {
            cards_locked = false
            if (player_id == current_player_id) {
                $('#turn_indicator').removeClass('d-none')
            } else {
                $('#turn_indicator').addClass('d-none')
            }
            $('#button_claim_trick').addClass('d-none')
        }

        // $('#card_' + msg.card_id).attr('alt', msg.username)

        // anyway there is no need anymore to deal cards
        $('#button_deal_cards').addClass('d-none')
    })

    socket.on('grab-your-cards', function (msg) {
        socket.emit('my-cards-please', {
            player_id: player_id,
            table_id: msg.table_id
        })
    })

    socket.on('your-cards-please', function (msg) {
        current_player_id = msg.current_player_id
        cards_locked = false
        console.log('your-cards-please')
        $('#table').html('')
        $('#hud_players').html(msg.html.hud_players)
        $('#hand').html(msg.html.cards_hand)
        $('#button_claim_trick').addClass('d-none')
        $('#modal_dialog').modal('hide')
        console.log(msg)
        console.log(player_id, current_player_id)
        if (player_id == current_player_id) {
            $('#turn_indicator').removeClass('d-none')
        } else {
            $('#turn_indicator').addClass('d-none')
        }
        if (player_id == msg.dealer) {
            $('#button_deal_cards').removeClass('d-none')
        } else {
            $('#button_deal_cards').addClass('d-none')
        }
    })

    socket.on('sorry-no-cards-for-you', function (msg) {
        $('#table').html('')
        $('#hand').html('')
    })

    socket.on('really-deal-again', function (msg) {
        $('.overlay-notification').addClass('d-none')
        $('#modal_body').html(msg.html)
        $("#modal_dialog").modal('show')
    })

    socket.on('next-trick', function (msg) {
        current_player_id = msg.current_player_id
        console.log(msg)
        cards_locked = false
        $('#table').html('')
        // $('.hud_player').removeClass('hud-player-active')
        if (player_id == current_player_id) {
            $('#turn_indicator').removeClass('d-none')
        } else {
            $('#turn_indicator').addClass('d-none')
            // $('#hud_player_' + current_player_id).addClass('hud-player-active')
        }
        $('#hud_players').html(msg.html.hud_players)
        console.log(msg.score)
        console.log(player_id in msg.score)
        if (player_id in msg.score) {
            console.log(msg.score[player_id])
            $('#cards_stack').attr('title', msg.score[player_id])
            $('#cards_stack').removeClass('d-none')
        } else {
            $('#cards_stack').addClass('d-none')
        }
    })

    socket.on('round-finished', function (msg) {
        console.log('round-finished', msg)
        $('#button_claim_trick').addClass('d-none')
        // cleanup content of dialog
        $('#modal_body').html(msg.html)
        $("#modal_dialog").modal('show')
    })

    socket.on('start-next-round', function (msg) {
        console.log('start-next-round', msg)
        // if (player_id == msg.dealer) {
        //     $('#button_deal_cards').removeClass('d-none')
        // } else {
        //     $('#button_deal_cards').addClass('d-none')
        // }
        $('.overlay-button').addClass('d-none')
        $('.overlay-notification').addClass('d-none')
        $('#modal_body').html(msg.html)
        console.log('why???')
        $("#modal_dialog").modal('show')
    })

    socket.on('round-reset-requested', function (msg) {
        console.log('round-reset-requested', msg)
        $('.overlay-button').addClass('d-none')
        $('.overlay-notification').addClass('d-none')
        // cleanup content of dialog
        $('#modal_body').html(msg.html)
        $('#modal_dialog').modal('show')
    })

    socket.on('round-finish-requested', function (msg) {
        console.log('round-finish-requested', msg)
        $('.overlay-button').addClass('d-none')
        $('.overlay-notification').addClass('d-none')
        // cleanup content of dialog
        $('#modal_body').html(msg.html)
        $('#modal_dialog').modal('show')
    })

    socket.on('round-restart-options', function (msg) {
        console.log('round-restart-requested', msg)
        $('.overlay-button').addClass('d-none')
        $('.overlay-notification').addClass('d-none')
        // cleanup content of dialog
        $('#modal_body').html(msg.html)
        $('#modal_dialog').modal('show')
    })

    $(document).on('click', '#new_table', function () {
        socket.emit('new-table', {button: 'new_table'})
    })

    $(document).on('click', '.list-item-table', function () {
        socket.emit('enter-table', {
            player_id: player_id,
            table_id: $(this).data('table_id')
        })
    })

    $(document).on('click', '#button_deal_cards', function () {
        console.log('button_deal_cards')
        socket.emit('deal-cards', {
            player_id: player_id,
            table_id: $(this).data('table_id')
        })
    })

    $(document).on('click', '#button_deal_cards_again', function () {
        console.log('button_deal_cards_again')
        socket.emit('deal-cards-again', {
            player_id: player_id,
            table_id: $(this).data('table_id')
        })
    })

    $(document).on('click', '#button_claim_trick', function () {
        console.log('claim trick')
        socket.emit('claim-trick', {
            player_id: player_id,
            table_id: $(this).data('table_id')
        })
    })

    $(document).on('click', '#button_next_round', function () {
        socket.emit('ready-for-next-round', {
            player_id: player_id,
            table_id: $(this).data('table_id')
        })
    })

    $(document).on('click', '#menu_request_round_reset', function () {
        console.log('request_round_reset')
        socket.emit('request-round-reset', {
            player_id: player_id,
            table_id: $(this).data('table_id')
        })
    })

    $(document).on('click', '#button_round_reset_yes', function () {
        socket.emit('ready-for-round-reset', {
            player_id: player_id,
            table_id: $(this).data('table_id')
        })
    })

    $(document).on('click', '#menu_request_round_finish', function () {
        socket.emit('request-round-finish', {
            player_id: player_id,
            table_id: $(this).data('table_id')
        })
    })

    $(document).on('click', '#menu_request_round_restart', function () {
        console.log('request_round_restart')
        socket.emit('request-round-restart', {
            player_id: player_id,
            table_id: $(this).data('table_id')
        })
    })

    $(document).on('click', '#button_round_finish_yes', function () {
        console.log('button ready finish reset')
        socket.emit('ready-for-round-finish', {
            player_id: player_id,
            table_id: $(this).data('table_id')
        })
    })

    $(document).on('click', '#button_round_restart_yes', function () {
        console.log('button ready restart')
        socket.emit('ready-for-round-restart', {
            player_id: player_id,
            table_id: $(this).data('table_id')
        })
    })
})