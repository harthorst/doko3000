// globally used player_id
let player_id = ''
// for staying in sync with the game this is global
let turn_count = 0
// keep an eye on next player to know if turns are allowed or not
let current_player_id = ''
// lock dragging of cards while waiting for trick being claimed
let cards_locked = false

// show alert messages
function show_message(place, message) {
    $(place).html('<div class="mx-3 mt-3 mb-1 alert alert-danger alert-dismissible dialog-message">' +
        '<a href="#" class="close" data-dismiss="alert" aria-label="close">&times;</a>' +
        message +
        '</div>')
}

function clear_message(place) {
    $(place).html('')
}

$(document).ready(function () {
    const socket = io()
    // initialize drag&drop
    let dragging_cards = dragula([document.querySelector('#hand'),
        document.querySelector('#table'), {
            revertOnSpill: true,
            direction: 'horizontal'
        }
    ]);
    dragging_cards.on('drop', function (card, target, source) {
        // do not drag your gained tricks around
        if (card.id == 'cards_stack') {
            dragging_cards.cancel(true)
        } else if (source.id == 'hand' && target.id == 'table' && player_id == current_player_id && !cards_locked) {
            if ($(card).data('timestamp') == $('#cards_table_timestamp').data('timestamp')) {
                $('#table').append(card)
                // add tooltip
                $(card).attr('title', player_id)
                socket.emit('played-card', {
                    player_id: player_id,
                    card_id: $(card).data('id'),
                    card_name: $(card).data('name'),
                    table_id: $(card).data('table_id')
                })
            } else {
                // card does not belong to hand because the dealer dealed again while the card was dragged around
                $(card).remove()
            }
        } else if (source.id == 'hand' && target.id == 'hand') {
            // check if card and hand have the same timestamp - otherwise someone dealed new cards
            // and the dragged card does not belong to the current cards
            if ($(card).data('timestamp') == $('#cards_hand_timestamp').data('timestamp')) {
                // get cards order to end it to server for storing it
                let cards_hand_ids = []
                for (let card_hand of $('#hand').children('.game-card-hand')) {
                    cards_hand_ids.push($(card_hand).data('id'))
                }
                socket.emit('sorted-cards', {
                    player_id: player_id,
                    table_id: $(card).data('table_id'),
                    cards_hand_ids: cards_hand_ids
                })
                // to avoid later mess (cards stack inside the cards at hand) move stack to end
                $('#cards_stack').appendTo('#hand')
                return true
            } else {
                // card does not belong to hand because the dealer dealed again while the card was dragged around
                $(card).remove()
            }
        } else if (source.id == 'table' || cards_locked || player_id != current_player_id) {
            dragging_cards.cancel(true)
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
        //$('#hud_players').html('')
        $('#hud_players').html(msg.html.hud_players)
        $('.overlay-button').addClass('d-none')

        // $('.hud_player').removeClass('hud-player-active')
        // if (!msg.is_last_turn) {
        //     $('#hud_player_' + msg.current_player_id).addClass('hud-player-active')
        // }
        // if (player_id != msg.player_id) {
        //     // $('#table').append(msg.html.card)
        //     $('#table').html(msg.html.cards_table)
        //     $('#card_' + msg.card_id).attr('title', msg.player_id)
        // }

        $('#table').html(msg.html.cards_table)
        // $('#card_' + msg.card_id).attr('title', msg.player_id)

        if (msg.is_last_turn) {
            cards_locked = true
            $('#turn_indicator').addClass('d-none')
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
        // anyway there is no need anymore to deal cards
        $('#button_deal_cards_again').addClass('d-none')
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
        $('#table').html(msg.html.cards_table)
        $('#hud_players').html(msg.html.hud_players)
        $('#hand').html(msg.html.cards_hand)
        $('#button_claim_trick').addClass('d-none')
        $('#modal_dialog').modal('hide')
        if (player_id == current_player_id) {
            $('#turn_indicator').removeClass('d-none')
        } else {
            $('#turn_indicator').addClass('d-none')
        }
        if (player_id == msg.dealer) {
            $('#button_deal_cards_again').removeClass('d-none')
        } else {
            $('#button_deal_cards_again').addClass('d-none')
        }
    })

    socket.on('sorry-no-cards-for-you', function (msg) {
        $('#table').html('')
        $('#hand').html('')
        $('#hud_players').html(msg.html.hud_players)
    })

    socket.on('really-deal-again', function (msg) {
        $('.overlay-notification').addClass('d-none')
        $('#modal_body').html(msg.html)
        $("#modal_dialog").modal('show')
    })

    socket.on('next-trick', function (msg) {
        current_player_id = msg.current_player_id
        cards_locked = false
        $('#table').html(msg.html.cards_table)
        if (player_id == current_player_id) {
            $('#turn_indicator').removeClass('d-none')
        } else {
            $('#turn_indicator').addClass('d-none')
            // $('#hud_player_' + current_player_id).addClass('hud-player-active')
        }
        $('#hud_players').html(msg.html.hud_players)
        if (msg.score[player_id] > 0) {
            $('#cards_stack').attr('title', msg.score[player_id])
            $('#cards_stack').removeClass('d-none')
        } else {
            $('#cards_stack').addClass('d-none')
        }
    })

    socket.on('round-finished', function (msg) {
        $('#button_claim_trick').addClass('d-none')
        // cleanup content of dialog
        $('#modal_body').html(msg.html)
        $("#modal_dialog").modal('show')
    })

    socket.on('start-next-round', function (msg) {
        $('.overlay-button').addClass('d-none')
        $('.overlay-notification').addClass('d-none')
        $('#modal_body').html(msg.html)
        console.log(msg)
        if (player_id == msg.dealer) {
            $('#button_deal_cards').removeClass('d-none')
            $('#button_close_info').addClass('d-none')
        } else {
            $('#button_deal_cards').addClass('d-none')
            $('#button_close_info').removeClass('d-none')
        }
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
        $('.overlay-button').addClass('d-none')
        $('.overlay-notification').addClass('d-none')
        // cleanup content of dialog
        $('#modal_body').html(msg.html)
        $('#modal_dialog').modal('show')
    })

    socket.on('round-restart-options', function (msg) {
        $('.overlay-button').addClass('d-none')
        $('.overlay-notification').addClass('d-none')
        // cleanup content of dialog
        $('#modal_body').ht
        ml(msg.html)
        $('#modal_dialog').modal('show')
    })

    socket.on('change-password-successful', function (msg) {
        $('#button_change_password').removeClass('btn-outline-primary')
        $('#button_change_password').removeClass('btn-outline-danger')
        $('#button_change_password').addClass('btn-outline-success')
        $('#indicate_change_password_successful').removeClass('d-none')
        $('#indicate_change_password_failed').addClass('d-none')
    })

    socket.on('change-password-failed', function (msg) {
        $('#button_change_password').removeClass('btn-outline-primary')
        $('#button_change_password').removeClass('btn-outline-success')
        $('#button_change_password').addClass('btn-outline-danger')
        $('#indicate_change_password_successful').addClass('d-none')
        $('#indicate_change_password_failed').removeClass('d-none')
    })

    $(document).on('click', '.button-enter-table', function () {
        socket.emit('enter-table', {
            player_id: player_id,
            table_id: $(this).data('table_id')
        })
        // ask server via json if player is allowed to enter or not
        return $.getJSON('/enter/table/' + $(this).data('table_id') + '/' + player_id,
            function (data, status) {
                if (status == 'success' && data.allowed) {
                    return data.allowed
                }
                // dummy return just in case
                return false
            })
    })

    // set focus onto defined form field
    $('#modal_dialog').on('shown.bs.modal', function () {
        $('.form-focus').focus()
    })

    // create new table
    $(document).on('click', '#button_create_table', function () {
        $.getJSON('/create/table', function (data, status) {
            if (status == 'success') {
                $('#modal_body').html(data.html)
                clear_message('#modal_message')
                $('#modal_dialog').modal('show')
            }
        })
        return false
    })

    // parameter 'json' makes it equivalent to non-existing .postJSON
    $(document).on('click', '#button_finish_create_table', function () {
        // parameter 'json' makes it equivalent to .getJSON
        // because there is no .postJSON but .post(..., 'json') so it will be the same for GET and POST here
        $.post('/create/table', $('#form_create_table').serialize(), function (data, status) {
            if (status == 'success') {
                if (data.status == 'error') {
                    show_message('#modal_message', data.message)
                } else if (data.status == 'ok') {
                    $('#modal_dialog').modal('hide')
                    $.getJSON('/get/tables',
                        function (data, status) {
                            if (status == 'success') {
                                $('#list_tables').html(data.html)
                            }
                        })
                }
            }
        }, 'json')
        return false
    })

    // draggable list of players in setup table dialog
    $(document).on('click', '.setup-table', function () {
        $.getJSON('/setup/table/' + $(this).data('table_id'), function (data, status) {
            if (status == 'success' && data.allowed) {
                $("#modal_body").html(data.html)
                $('#modal_dialog').modal('show')
                let dragging_players = dragula([document.querySelector('#setup_table_players'),
                    {
                        revertOnSpill: true,
                        direction: 'vertical'
                    }
                ]);
                dragging_players.on('drop', function (player, target) {
                    // players order has been changed
                    let order = []
                    for (let player of $(target).children('.player')) {
                        order.push($(player).data('player_id'))
                    }
                    socket.emit('setup-table-change', {
                        action: 'changed_order',
                        player_id: player_id,
                        table_id: $(target).data('table_id'),
                        order: order
                    })
                })
            }
        })
        return false
    })

    // lock table number of players
    $(document).on('click', '#table_lock', function () {
        if (this.checked) {
            $('#table_lock_icon').removeClass('oi-lock-unlocked')
            $('#table_lock_icon').addClass('oi-lock-locked')
            socket.emit('setup-table-change', {
                action: 'lock_table',
                player_id: player_id,
                table_id: $(this).data('table_id')
            })
        } else {
            $('#table_lock_icon').addClass('oi-lock-unlocked')
            $('#table_lock_icon').removeClass('oi-lock-locked')
            socket.emit('setup-table-change', {
                action: 'unlock_table',
                player_id: player_id,
                table_id: $(this).data('table_id')
            })
        }
    })

    // enable playing with card '9'
    $(document).on('click', '#switch_card_9', function () {
        if (this.checked) {
            socket.emit('setup-table-change', {
                action: 'play_with_9',
                player_id: player_id,
                table_id: $(this).data('table_id')
            })
        } else {
            socket.emit('setup-table-change', {
                action: 'play_without_9',
                player_id: player_id,
                table_id: $(this).data('table_id')
            })
        }
    })

    // delete a player in the draggable players order
    $(document).on('click', '.button-remove-player-from-table', function () {
        if (player_id != $(this).data('player_id')) {
            // used too if player leaves table via menu
            socket.emit('setup-table-change', {
                action: 'remove_player',
                player_id: $(this).data('player_id'),
                table_id: $(this).data('table_id')
            })
            $('.table_player_' + $(this).data('player_id')).remove()
        }
    })

    // create new user
    $(document).on('click', '#button_create_player', function () {
        $.getJSON('/create/player', function (data, status) {
            if (status == 'success') {
                $('#modal_body').html(data.html)
                clear_message('#modal_message')
                $('#modal_dialog').modal('show')
            }
        })
        return false
    })

    // take player id as password
    $(document).on('click', '#button_password_from_player', function () {
        $('#new_player_password').val($('#new_player_id').val())
        return false
    })

    // create random password
    $(document).on('click', '#button_password_from_random', function () {
        $('#new_player_password').val(btoa(Math.random()).substr(5, 8))
        return false
    })

    // parameter 'json' makes it equivalent to non-existing .postJSON
    $(document).on('click', '#button_finish_create_player', function () {
        // parameter 'json' makes it equivalent to .getJSON
        // because there is no .postJSON but .post(..., 'json') so it will be the same for GET and POST here
        $.post('/create/player', $('#form_create_player').serialize(), function (data, status) {
            if (status == 'success') {
                if (data.status == 'error') {
                    show_message('#modal_message', data.message)
                } else if (data.status == 'ok') {
                    $('#modal_dialog').modal('hide')
                    $.getJSON('/get/players',
                        function (data, status) {
                            if (status == 'success') {
                                $('#list_players').html(data.html)
                            }
                        })
                }
            }
        }, 'json')
        return false
    })

    // delete a player in the players list
    $(document).on('click', '.button-delete-player', function () {
        if (player_id != $(this).data('player_id')) {
            $.getJSON('/delete/player/' + encodeURIComponent($(this).data('player_id')),
                function (data, status) {
                    if (status == 'success') {
                        $('#modal_body').html(data.html)
                        clear_message('#modal_message')
                        $('#modal_dialog').modal('show')
                    }
                })
        }
    })

    // really delete player after safety dialog
    $(document).on('click', '#button_really_delete_player', function () {
        if (player_id != $(this).data('player_id')) {
            // once again the .post + 'json' move
            $.post('/delete/player/' + encodeURIComponent($(this).data('player_id')),
                function (data, status) {
                console.log(data)
                    if (status == 'success') {
                        $('#list_players').html(data.html)
                    } else {
                        console.log(data.message)
                    show_message('#modal_message', data.message)
                    }
                }, 'json')
        }
        return false
    })

    // delete a player in the players list
    $(document).on('click', '.button-delete-table', function () {
            $.getJSON('/delete/table/' + encodeURIComponent($(this).data('table_id')),
                function (data, status) {
                    if (status == 'success') {
                        $('#modal_body').html(data.html)
                        clear_message('#modal_message')
                        $('#modal_dialog').modal('show')
                    }
                })
    })

    $(document).on('click', '#button_deal_cards', function () {
        socket.emit('deal-cards', {
            player_id: player_id,
            table_id: $(this).data('table_id')
        })
    })

    $(document).on('click', '#button_start_table', function () {
        socket.emit('setup-table-change', {
            action: 'start_table',
            player_id: player_id,
            table_id: $(this).data('table_id')
        })
        if (window.location.pathname.startsWith('/table/')) {
            location.reload()
        }
    })

    // reload page after setup
    $(document).on('click', '#button_finish_table_setup', function () {
        if (window.location.pathname.startsWith('/table/')) {
            location.reload()
        } else {
            $.getJSON('/get/tables',
                function (data, status) {
                    if (status == 'success') {
                        $('#list_tables').html(data.html)
                    }
                })
        }
    })

    // player setup
    $(document).on('click', '.setup-player', function () {
        $.getJSON('/setup/player/' + $(this).data('player_id'), function (data, status) {
            if (status == 'success') {
                $("#modal_body").html(data.html)
                $('#modal_dialog').modal('show')
            }
        })
    })

    // make player an admin
    $(document).on('click', '#switch_player_is_admin', function () {
        if (this.checked) {
            socket.emit('setup-player-change', {
                action: 'is_admin',
                player_id: $(this).data('player_id')
            })
        } else {
            socket.emit('setup-player-change', {
                action: 'is_no_admin',
                player_id: $(this).data('player_id')
            })
        }
    })

    // change password
    $(document).on('click', '#button_change_password', function () {
        console.log('password change')
        socket.emit('setup-player-change', {
            action: 'new_password',
            player_id: $(this).data('player_id'),
            password: $('#new_player_password').val()
        })
    })

    // reset password change button when password gets changed
    $(document).on('keyup', '#new_player_password', function () {
        $('#button_change_password').addClass('btn-outline-primary')
        $('#button_change_password').removeClass('btn-outline-success')
        $('#button_change_password').removeClass('btn-outline-danger')
        $('#indicate_change_password_successful').addClass('d-none')
        $('#indicate_change_password_failed').addClass('d-none')
    })

    $(document).on('click', '#button_deal_cards_again', function () {
        socket.emit('deal-cards-again', {
            player_id: player_id,
            table_id: $(this).data('table_id')
        })
    })

    $(document).on('click', '#button_claim_trick', function () {
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

    // $(document).on('click', '#button_round_reset_yes', function () {
    //     socket.emit('ready-for-round-reset', {
    //         player_id: player_id,
    //         table_id: $(this).data('table_id')
    //     })
    // })

    $(document).on('click', '#button_round_reset_yes', function () {
        let table_id = $(this).data('table_id')
        $.getJSON('/get/wait', function (data, status) {
            if (status == 'success') {
                $('#modal_body').html(data.html)
                socket.emit('ready-for-round-reset', {
                    player_id: player_id,
                    table_id: table_id
                })
            }
        })
        // dummy return just in case
        return false
    })


    $(document).on('click', '#menu_request_round_finish', function () {
        socket.emit('request-round-finish', {
            player_id: player_id,
            table_id: $(this).data('table_id')
        })
    })

    $(document).on('click', '#button_round_finish_yes', function () {
        let table_id = $(this).data('table_id')
        $.getJSON('/get/wait', function (data, status) {
            if (status == 'success') {
                $('#modal_body').html(data.html)
                socket.emit('ready-for-round-finish', {
                    player_id: player_id,
                    table_id: table_id
                })
            }
        })
        // dummy return just in case
        return false
    })

    // $(document).on('click', '#button_round_restart_yes', function () {
    //     let table_id = $(this).data('table_id')
    //     $.getJSON('/get/wait', function (data, status) {
    //         if (status == 'success') {
    //             $('#modal_body').html(data.html)
    //             socket.emit('ready-for-round-restart', {
    //                 player_id: player_id,
    //                 table_id: table_id
    //             })
    //         }
    //     })
    //     // dummy return just in case
    //     return false
    // })
})